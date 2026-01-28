// Attendance service - handles attendance logging with business rules
import {
  getAttendanceLogsByDateRange,
  getEmployeeById,
  getLastAttendanceLogForEmployee,
  getRecentAttendanceLogForEmployee,
  insertAttendanceLog,
} from "../db/database";
import type { AttendanceLog } from "../types";
import { DUPLICATE_WINDOW_SECONDS } from "../utils/constants";
import {
  getCurrentTimestamp,
  getEndOfDay,
  getStartOfDay,
} from "../utils/helpers";
import { Logger } from "../utils/logger";
import { getActiveOrgBranchIds, getDeviceId } from "./settings";

const logger = new Logger("Attendance");

export class DuplicateAttendanceError extends Error {
  secondsAgo: number;
  constructor(secondsAgo: number) {
    super(`Duplicate attendance prevented. Last log was ${secondsAgo} seconds ago.`);
    this.name = "DuplicateAttendanceError";
    this.secondsAgo = secondsAgo;
  }
}

export interface AttendanceEntry {
  employeeId: string;
  employeeName: string;
  type: "IN" | "OUT";
  timestamp: number;
  confidence: number;
  photoPath?: string;
}

/**
 * Log attendance for an employee with duplicate prevention and IN/OUT toggling
 */
export async function logAttendance(
  employeeId: string,
  confidence: number,
  photoPath?: string,
): Promise<AttendanceEntry> {
  try {
    const { orgId, branchId } = await getActiveOrgBranchIds();
    // Prevent duplicates within window
    const recentLog = await getRecentAttendanceLogForEmployee(
      orgId,
      branchId,
      employeeId,
      DUPLICATE_WINDOW_SECONDS,
    );
    if (recentLog) {
      const secondsAgo = Math.floor((Date.now() - recentLog.ts_local) / 1000);
      throw new DuplicateAttendanceError(secondsAgo);
    }

    const startOfToday = getStartOfDay(Date.now());
    const lastLogToday = await getLastAttendanceLogForEmployee(
      orgId,
      branchId,
      employeeId,
      startOfToday,
    );

    let type: "IN" | "OUT" = "IN";
    if (lastLogToday && lastLogToday.type === "IN") {
      type = "OUT";
    }

    const deviceId = await getDeviceId();
    const timestamp = getCurrentTimestamp();

    await insertAttendanceLog({
      org_id: orgId,
      branch_id: branchId,
      device_id: deviceId,
      employee_id: employeeId,
      type,
      ts_local: timestamp,
      confidence,
      server_id: null,
      created_at: timestamp,
    });

    const employee = await getEmployeeById(employeeId);
    const employeeName = employee?.name || "Employee";

    logger.info(
      `Logged ${type} for ${employeeName} at ${new Date(timestamp).toLocaleString()}`,
    );

    return {
      employeeId,
      employeeName,
      type,
      timestamp,
      confidence,
      photoPath,
    };
  } catch (error) {
    if (error instanceof DuplicateAttendanceError) {
      // Expected condition - not an application error
      logger.info("Duplicate attendance prevented", error);
      throw error;
    }
    logger.error("Failed to log attendance", error);
    throw error;
  }
}

export async function getAttendanceLogs(
  startDate: Date,
  endDate: Date,
): Promise<AttendanceLog[]> {
  const { orgId, branchId } = await getActiveOrgBranchIds();
  const startTs = getStartOfDay(startDate.getTime());
  const endTs = getEndOfDay(endDate.getTime());
  return await getAttendanceLogsByDateRange(orgId, branchId, startTs, endTs);
}

export async function getTodayAttendanceLogs(): Promise<AttendanceLog[]> {
  const today = new Date();
  return await getAttendanceLogs(today, today);
}

export async function getAttendanceStats(
  startDate: Date,
  endDate: Date,
): Promise<{ totalIn: number; totalOut: number }> {
  const logs = await getAttendanceLogs(startDate, endDate);
  const totalIn = logs.filter((log) => log.type === "IN").length;
  const totalOut = logs.filter((log) => log.type === "OUT").length;
  return { totalIn, totalOut };
}
