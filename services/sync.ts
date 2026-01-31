// Sync service - handles background sync with API
import NetInfo from "@react-native-community/netinfo";
import
  {
    getAllEmployees,
    getUnsyncedAttendanceLogs,
    markAttendanceLogsSynced,
    replaceEmployeeShifts,
    updateAttendanceLogsServerInfo,
    upsertEmployeeFromServer,
    upsertShift,
  } from "../db/database";
import type { AttendanceLog, Employee } from "../types";
import
  {
    SYNC_BATCH_SIZE,
    SYNC_RETRY_BASE_DELAY,
    SYNC_RETRY_MAX,
  } from "../utils/constants";
import { Logger } from "../utils/logger";
import { syncEventEmitter } from "../utils/syncEventEmitter";
import
  {
    getActiveOrgBranchIds,
    getDeviceId,
    getDeviceToken,
    getLastSyncTimestamp,
    getSettings,
    setLastSyncTimestamp,
  } from "./settings";

const logger = new Logger("SyncService");

export interface SyncResult {
  success: boolean;
  syncedLogs: number;
  pulledEmployees: number;
  pulledShifts: number;
  pushedEmployees: number;
  errors: string[];
}

class SyncService {
  private syncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Start background sync with specified interval
   */
  startBackgroundSync(intervalMinutes: number): void {
    if (this.syncInterval) {
      this.stopBackgroundSync();
    }

    logger.info(`Starting background sync (every ${intervalMinutes} minutes)`);

    // Initial sync
    this.performSync();

    // Schedule periodic sync
    this.syncInterval = setInterval(
      () => {
        this.performSync();
      },
      intervalMinutes * 60 * 1000,
    );
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info("Background sync stopped");
    }
  }

  /**
   * Check if device is properly registered with the backend
   */
  async isDeviceRegistered(apiBaseUrl: string): Promise<boolean> {
    try {
      const deviceToken = await getDeviceToken();
      if (!deviceToken) {
        logger.debug(
          "Device not registered - no token found. Use Settings to register.",
        );
        return false;
      }

      // Optional: Verify token is still valid by calling a lightweight endpoint
      // Skip for now to avoid unnecessary API calls
      return true;
    } catch (error) {
      logger.debug("Failed to check device registration", error);
      return false;
    }
  }

  /**
   * Perform sync operation
   */
  async performSync(): Promise<SyncResult> {
    if (this.syncing) {
      logger.info("Sync already in progress, skipping");
      return {
        success: false,
        syncedLogs: 0,
        pulledEmployees: 0,
        pulledShifts: 0,
        pushedEmployees: 0,
        errors: ["Sync already in progress"],
      };
    }

    this.syncing = true;
    const result: SyncResult = {
      success: true,
      syncedLogs: 0,
      pulledEmployees: 0,
      pulledShifts: 0,
      pushedEmployees: 0,
      errors: [],
    };

    try {
      // Check connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        logger.info("No internet connection, skipping sync");
        result.success = false;
        result.errors.push("No internet connection");
        return result;
      }

      // Get settings
      const settings = await getSettings();
      if (!settings.api_base_url) {
        logger.info("API base URL not configured, skipping sync");
        return result;
      }

      // Check device registration
      const isRegistered = await this.isDeviceRegistered(settings.api_base_url);
      if (!isRegistered) {
        logger.info(
          "Device not registered. Skipping data pull operations. Use Settings to register.",
        );
        // Still try to push logs even without device token (legacy mode)
        const { orgId, branchId } = await getActiveOrgBranchIds();
        const deviceId = await getDeviceId();
        const logsSynced = await this.syncAttendanceLogs(
          settings.api_base_url,
          orgId,
          branchId,
          deviceId,
        );
        result.syncedLogs = logsSynced;
        logger.info(`Sync completed (offline): ${result.syncedLogs} logs`);
        return result;
      }

      logger.info("Starting sync...");

      // Sync attendance logs
      const { orgId, branchId } = await getActiveOrgBranchIds();
      logger.info(
        `[Sync] Using org/branch IDs: orgId="${orgId}" (type: ${typeof orgId}), branchId="${branchId}" (type: ${typeof branchId})`,
      );
      const deviceId = await getDeviceId();

      // Pull employees and shifts first (server is source of truth)
      const pulledEmployees = await this.pullEmployees(
        settings.api_base_url,
        orgId,
        branchId,
      );
      result.pulledEmployees = pulledEmployees;

      const pulledShifts = await this.pullShifts(
        settings.api_base_url,
        orgId,
        branchId,
      );
      result.pulledShifts = pulledShifts;

      const logsSynced = await this.syncAttendanceLogs(
        settings.api_base_url,
        orgId,
        branchId,
        deviceId,
      );
      result.syncedLogs = logsSynced;

      logger.info(
        `Sync completed: ${result.syncedLogs} logs, ${result.pulledEmployees} employees, ${result.pulledShifts} shifts`,
      );

      // Notify listeners of sync completion (always fire to ensure UI updates)
      logger.info(
        `[Events] Emitting sync events: employees=${result.pulledEmployees}, shifts=${result.pulledShifts}, logs=${result.syncedLogs}`,
      );

      // Always notify to trigger UI refresh even if counts are 0
      syncEventEmitter.notifyEmployeesSynced(result.pulledEmployees);
      syncEventEmitter.notifyShiftsSynced(result.pulledShifts);
      syncEventEmitter.notifyLogsSynced(result.syncedLogs);
      syncEventEmitter.notifySyncComplete();
    } catch (error: any) {
      logger.error("Sync failed", error);
      result.success = false;
      result.errors.push(error.message || "Unknown error");
    } finally {
      this.syncing = false;
    }

    return result;
  }

  /**
   * Sync unsynced attendance logs
   */
  private async syncAttendanceLogs(
    apiBaseUrl: string,
    orgId: string,
    branchId: string,
    deviceId: string,
  ): Promise<number> {
    let totalSynced = 0;

    try {
      const unsyncedLogs = await getUnsyncedAttendanceLogs(
        orgId,
        branchId,
        SYNC_BATCH_SIZE,
      );

      if (unsyncedLogs.length === 0) {
        logger.debug("No logs to sync");
        return 0;
      }

      logger.info(`Syncing ${unsyncedLogs.length} attendance logs...`);

      // Send batch to API
      const response = await this.sendLogsToAPI(
        apiBaseUrl,
        unsyncedLogs,
        deviceId,
        branchId,
      );

      if (response.success) {
        // Mark as synced
        const logIds = unsyncedLogs.map((log) => log.id);
        await markAttendanceLogsSynced(logIds);
        if (response.mappings.length > 0) {
          await updateAttendanceLogsServerInfo(
            response.mappings.map((mapping) => ({
              id: mapping.client_id,
              server_log_id: mapping.server_id,
              sync_confirmed: mapping.confirmed ? 1 : undefined,
            })),
          );
        }
        if (response.confirmedIds.length > 0) {
          await updateAttendanceLogsServerInfo(
            response.confirmedIds.map((id) => ({
              id,
              sync_confirmed: 1,
            })),
          );
        }
        totalSynced = unsyncedLogs.length;
        logger.info(`Successfully synced ${totalSynced} logs`);
      } else {
        throw new Error(`API returned error: ${response.error}`);
      }
    } catch (error) {
      logger.error("Failed to sync logs", error);
      throw error;
    }

    return totalSynced;
  }

  /**
   * Legacy: Sync dirty employees to API
   */
  private async pushLegacyEmployees(
    apiBaseUrl: string,
    orgId: string,
    branchId: string,
  ): Promise<number> {
    try {
      const allEmployees = await getAllEmployees(orgId, branchId);
      const dirtyEmployees = allEmployees.filter(
        (emp) => emp.sync_state === "dirty",
      );

      if (dirtyEmployees.length === 0) {
        logger.debug("No employees to sync");
        return 0;
      }

      logger.info(`Syncing ${dirtyEmployees.length} employees...`);

      // Send to API
      const response = await this.sendEmployeesToAPI(
        apiBaseUrl,
        dirtyEmployees,
      );

      if (response.success) {
        logger.info(`Successfully synced ${dirtyEmployees.length} employees`);
        return dirtyEmployees.length;
      } else {
        throw new Error(`API returned error: ${response.error}`);
      }
    } catch (error) {
      logger.error("Failed to sync employees", error);
      // Don't throw - employee sync is optional
      return 0;
    }
  }

  /**
   * Pull employees from API (server is source of truth)
   */
  private async pullEmployees(
    apiBaseUrl: string,
    orgId: string,
    branchId: string,
  ): Promise<number> {
    try {
      logger.info(
        `[Pull] Starting employee pull with orgId="${orgId}", branchId="${branchId}"`,
      );
      const deviceToken = await getDeviceToken();
      if (!deviceToken) {
        logger.debug(
          "Skipping employee pull - device not registered. Use Settings to register device.",
        );
        return 0;
      }

      const lastSync = await getLastSyncTimestamp("employees");
      const url = `${apiBaseUrl}/api/v1/attendance/sync/employees?branch_id=${branchId}&since=${lastSync}`;
      logger.debug(`[Pull] Fetching employee data from: ${url}`);
      const response = await this.sendAuthenticatedRequest(url, "GET");
      if (!response.ok) {
        if (response.status === 401) {
          logger.error(
            "[Auth] Employee pull failed: Device token invalid or expired. Status 401.",
          );
          logger.info(
            "Please go to Settings > Register Device to re-register your device.",
          );
          return 0;
        }
        if (response.status >= 500) {
          logger.warn(
            `[Server Error] Employee pull failed: HTTP ${response.status}. Server may be offline.`,
          );
          return 0;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug("[Pull] Raw API response:", { data, url });
      const employees = Array.isArray(data?.employees) ? data.employees : [];
      logger.info(`[Pull] Received ${employees.length} employees from API`);

      if (employees.length === 0) {
        logger.warn(
          `[Pull] No employees returned from API. Context: orgId="${orgId}" (type: ${typeof orgId}), branchId="${branchId}" (type: ${typeof branchId})`,
        );
      }

      for (const emp of employees) {
        const empId = emp.id || emp.employee_id;
        if (!empId) {
          logger.warn("[Pull] Skipping employee - no ID found", emp);
          continue;
        }
        const updatedAt =
          typeof emp.updated_at === "number"
            ? emp.updated_at
            : Date.parse(emp.updated_at || "");

        // Ensure org_id and branch_id are strings for consistent DB queries
        const empOrgId = String(emp.org_id || emp.business_id || orgId);
        const empBranchId = String(emp.branch_id || branchId);

        logger.debug(
          `[Pull] Upserting employee: id=${empId}, org_id=${empOrgId} (from: org_id=${emp.org_id}, business_id=${emp.business_id}, fallback=${orgId}), branch_id=${empBranchId} (from: ${emp.branch_id}, fallback=${branchId}), name=${emp.name || emp.full_name}`,
        );

        await upsertEmployeeFromServer({
          id: empId,
          org_id: empOrgId,
          branch_id: empBranchId,
          user_id: emp.user_id || undefined,
          name: emp.name || emp.full_name || "Unknown",
          code: emp.employee_code || emp.code || undefined,
          status: emp.status === "inactive" ? "inactive" : "active",
          embeddings_json:
            emp.embeddings_json || emp.embeddings_encrypted || undefined,
          last_server_update:
            typeof emp.last_synced_at === "number"
              ? emp.last_synced_at
              : Date.parse(emp.last_synced_at || "") || updatedAt,
          updated_at: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        });
        logger.debug(`[Pull] Successfully upserted employee: ${empId}`);
      }

      await setLastSyncTimestamp("employees", Date.now());
      logger.info(`[Pull] Successfully synced ${employees.length} employees`);
      return employees.length;
    } catch (error: any) {
      logger.error("Failed to pull employees", error.message || error);
      return 0;
    }
  }

  /**
   * Pull shifts from API
   */
  private async pullShifts(
    apiBaseUrl: string,
    orgId: string,
    branchId: string,
  ): Promise<number> {
    try {
      const deviceToken = await getDeviceToken();
      if (!deviceToken) {
        logger.debug(
          "Skipping shifts pull - device not registered. Use Settings to register device.",
        );
        return 0;
      }

      const lastSync = await getLastSyncTimestamp("shifts");
      const url = `${apiBaseUrl}/api/v1/attendance/sync/shifts?branch_id=${branchId}&since=${lastSync}`;
      logger.debug(`[Pull] Fetching shift data from: ${url}`);
      const response = await this.sendAuthenticatedRequest(url, "GET");
      if (!response.ok) {
        if (response.status === 401) {
          logger.error(
            "[Auth] Shifts pull failed: Device token invalid or expired. Status 401.",
          );
          logger.info(
            "Please go to Settings > Register Device to re-register your device.",
          );
          return 0;
        }
        if (response.status >= 500) {
          logger.warn(
            `[Server Error] Shifts pull failed: HTTP ${response.status}. Server may be offline.`,
          );
          return 0;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
      const employeeShifts = Array.isArray(data?.employee_shifts)
        ? data.employee_shifts
        : [];

      for (const shift of shifts) {
        if (!shift?.id) continue;
        const updatedAt =
          typeof shift.updated_at === "number"
            ? shift.updated_at
            : Date.parse(shift.updated_at || "");
        await upsertShift({
          id: shift.id,
          org_id: shift.org_id || shift.business_id || orgId,
          branch_id: shift.branch_id || null,
          name: shift.name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          grace_in_min: shift.grace_in_min || 0,
          grace_out_min: shift.grace_out_min || 0,
          grace_period_minutes: shift.grace_period_minutes || 0,
          working_days: shift.working_days
            ? JSON.stringify(shift.working_days)
            : shift.working_days_json || null,
          updated_at: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        });
      }

      if (employeeShifts.length > 0) {
        const byEmployee = new Map<string, any[]>();
        for (const row of employeeShifts) {
          const employeeId = row.employee_id || row.attendance_employee_id;
          if (!employeeId) continue;
          if (!byEmployee.has(employeeId)) {
            byEmployee.set(employeeId, []);
          }
          byEmployee.get(employeeId)!.push({
            id: row.id || `es_${employeeId}_${row.shift_id}_${Date.now()}`,
            org_id: row.org_id || row.business_id || orgId,
            shift_id: row.shift_id,
            effective_from:
              row.effective_from ||
              row.effective_from_date ||
              row.start_date ||
              new Date().toISOString(),
            effective_to: row.effective_to || row.end_date || null,
          });
        }

        for (const [employeeId, rows] of byEmployee.entries()) {
          await replaceEmployeeShifts(employeeId, rows);
        }
      }

      await setLastSyncTimestamp("shifts", Date.now());
      logger.info(`[Pull] Successfully synced ${shifts.length} shifts`);
      return shifts.length;
    } catch (error: any) {
      logger.error("Failed to pull shifts", error.message || error);
      return 0;
    }
  }

  /**
   * Push face enrollment to API
   */
  async pushFaceEnrollment(
    apiBaseUrl: string,
    employeeId: string,
    embeddingsEncrypted: string,
  ): Promise<void> {
    const url = `${apiBaseUrl}/api/v1/attendance/sync/employees/face-enrollment`;
    const response = await this.sendAuthenticatedRequest(url, "POST", {
      employee_id: employeeId,
      embeddings_encrypted: embeddingsEncrypted,
      enrolled_at: new Date().toISOString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Public helper: sync employees only (manual trigger)
   */
  public async syncEmployeesNow(): Promise<number> {
    const settings = await getSettings();
    if (!settings.api_base_url) {
      logger.info("API base URL not configured, skipping employee sync");
      return 0;
    }

    const { orgId, branchId } = await getActiveOrgBranchIds();
    const pulled = await this.pullEmployees(
      settings.api_base_url,
      orgId,
      branchId,
    );
    return pulled;
  }

  /**
   * Public helper: sync attendance logs only (manual/instant trigger)
   */
  public async syncAttendanceLogsNow(): Promise<number> {
    try {
      const settings = await getSettings();
      if (!settings.api_base_url || !settings.sync_enabled) {
        logger.debug(
          "Attendance sync skipped - API base URL not configured or sync disabled",
        );
        return 0;
      }

      const isRegistered = await this.isDeviceRegistered(settings.api_base_url);
      if (!isRegistered) {
        logger.debug(
          "Attendance sync skipped - device not registered",
        );
        return 0;
      }

      const { orgId, branchId } = await getActiveOrgBranchIds();
      const deviceId = await getDeviceId();
      const logsSynced = await this.syncAttendanceLogs(
        settings.api_base_url,
        orgId,
        branchId,
        deviceId,
      );
      return logsSynced;
    } catch (error: any) {
      logger.warn(
        "Immediate attendance sync failed",
        error?.message || error,
      );
      return 0;
    }
  }

  private async sendAuthenticatedRequest(
    url: string,
    method: "GET" | "POST" | "PATCH",
    body?: any,
  ): Promise<Response> {
    const deviceToken = await getDeviceToken();
    const deviceId = await getDeviceId();

    // Log authentication status
    if (!deviceToken) {
      logger.warn(
        "No device token found - device may not be registered with backend",
      );
    }

    // Use AbortController with manual timeout if available; otherwise fall back to Promise.race timeout
    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(deviceToken ? { Authorization: `Bearer ${deviceToken}` } : {}),
            "X-Device-ID": deviceId,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        return response;
      } catch (error: any) {
        // Detect abort/timeout and rethrow a clearer error
        if (
          error &&
          (error.name === "AbortError" ||
            error.message?.toLowerCase()?.includes("abort"))
        ) {
          throw new Error("Request timed out");
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Fallback for environments without AbortController
    return Promise.race([
      fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { Authorization: `Bearer ${deviceToken}` } : {}),
          "X-Device-ID": deviceId,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      new Promise((_res, rej) =>
        setTimeout(() => rej(new Error("Request timed out")), 15000),
      ),
    ]) as Promise<Response>;
  }

  /**
   * Send logs to API with retry logic
   */
  private async sendLogsToAPI(
    apiBaseUrl: string,
    logs: AttendanceLog[],
    deviceId: string,
    branchId: string,
    retryCount: number = 0,
  ): Promise<{
    success: boolean;
    error?: string;
    mappings: { client_id: string; server_id: string; confirmed?: boolean }[];
    confirmedIds: string[];
  }> {
    try {
      const url = `${apiBaseUrl}/api/v1/attendance/sync/logs`;
      const response = await this.sendAuthenticatedRequest(url, "POST", {
        device_id: deviceId,
        branch_id: branchId,
        logs: logs.map((log) => ({
          id: log.id,
          employee_id: log.employee_id,
          type: log.type,
          check_time: new Date(log.ts_local).toISOString(),
          confidence_score: log.confidence,
          device_id: log.device_id,
          branch_id: log.branch_id,
        })),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return await this.sendLogsToLegacyAPI(apiBaseUrl, logs, retryCount);
        }
        // Fail fast on auth errors - don't retry
        if (response.status === 401) {
          if (retryCount === 0) {
            logger.error(
              "[Auth] Attendance sync failed: Device token invalid or expired. Please re-register in Settings.",
            );
          }
          return {
            success: false,
            error:
              "Authentication failed - device not registered or token expired",
            mappings: [],
            confirmedIds: [],
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      const rawMappings =
        data.mappings || data.log_mappings || data.logs || data.log_ids || [];
      const mappings = Array.isArray(rawMappings)
        ? rawMappings
            .map((item: any) => ({
              client_id: item.client_id || item.id,
              server_id: item.server_id || item.server_log_id || item.remote_id,
              confirmed: item.confirmed,
            }))
            .filter((item: any) => item.client_id && item.server_id)
        : [];
      const confirmedIds = Array.isArray(data.confirmed_ids)
        ? data.confirmed_ids
        : [];

      return { success: true, mappings, confirmedIds };
    } catch (error: any) {
      // Don't log on retries - only on first attempt
      if (retryCount === 0) {
        logger.error(`Attendance sync failed: ${error.message}`);
      }

      // Retry with exponential backoff (only for transient errors, not auth)
      if (retryCount < SYNC_RETRY_MAX) {
        const delay = SYNC_RETRY_BASE_DELAY * Math.pow(2, retryCount);
        logger.info(
          `[Retry ${retryCount + 1}/${SYNC_RETRY_MAX}] Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendLogsToAPI(
          apiBaseUrl,
          logs,
          deviceId,
          branchId,
          retryCount + 1,
        );
      }

      return {
        success: false,
        error: error.message,
        mappings: [],
        confirmedIds: [],
      };
    }
  }

  private async sendLogsToLegacyAPI(
    apiBaseUrl: string,
    logs: AttendanceLog[],
    retryCount: number,
  ): Promise<{
    success: boolean;
    error?: string;
    mappings: { client_id: string; server_id: string; confirmed?: boolean }[];
    confirmedIds: string[];
  }> {
    try {
      const url = `${apiBaseUrl}/api/sync/logs`;
      // Use AbortController timeout if available, otherwise Promise.race fallback
      let response: Response;
      if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ logs }),
            signal: controller.signal,
          });
        } catch (error: any) {
          if (
            error &&
            (error.name === "AbortError" ||
              error.message?.toLowerCase()?.includes("abort"))
          ) {
            throw new Error("Request timed out");
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        // Fallback for environments without AbortController
        response = (await Promise.race([
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ logs }),
          }),
          new Promise((_res, rej) =>
            setTimeout(() => rej(new Error("Request timed out")), 15000),
          ),
        ])) as Response;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      const rawMappings = data.log_mappings || data.logs || [];
      const mappings = Array.isArray(rawMappings)
        ? rawMappings
            .map((item: any) => ({
              client_id: item.client_id || item.id,
              server_id: item.server_id || item.server_log_id || item.remote_id,
              confirmed: item.confirmed,
            }))
            .filter((item: any) => item.client_id && item.server_id)
        : [];

      return { success: true, mappings, confirmedIds: [] };
    } catch (error: any) {
      logger.error(
        `Legacy API request failed (attempt ${retryCount + 1}/${SYNC_RETRY_MAX})`,
        error,
      );
      return {
        success: false,
        error: error.message,
        mappings: [],
        confirmedIds: [],
      };
    }
  }

  /**
   * Send employees to API
   */
  private async sendEmployeesToAPI(
    apiBaseUrl: string,
    employees: Employee[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${apiBaseUrl}/api/sync/employees`;

      // Prepare employee data (remove binary embedding for JSON)
      const employeeData = employees.map((emp) => ({
        id: emp.id,
        org_id: emp.org_id,
        branch_id: emp.branch_id,
        name: emp.name,
        code: emp.code,
        status: emp.status,
        embeddings_json: emp.embeddings_json,
        updated_at: emp.updated_at,
      }));

      // Use AbortController timeout if available, otherwise Promise.race fallback
      let response: Response;
      if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ employees: employeeData }),
            signal: controller.signal,
          });
        } catch (error: any) {
          if (
            error &&
            (error.name === "AbortError" ||
              error.message?.toLowerCase()?.includes("abort"))
          ) {
            throw new Error("Request timed out");
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        // Fallback for environments without AbortController
        response = (await Promise.race([
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ employees: employeeData }),
          }),
          new Promise((_res, rej) =>
            setTimeout(() => rej(new Error("Request timed out")), 15000),
          ),
        ])) as Response;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true };
    } catch (error: any) {
      logger.error("Failed to send employees to API", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull updates from API (placeholder for future implementation)
   */
  async pullUpdates(apiBaseUrl: string, since: number): Promise<void> {
    try {
      // Placeholder: Pull employee updates
      const employeesUrl = `${apiBaseUrl}/api/sync/employees?since=${since}`;
      // const response = await fetch(employeesUrl);
      // Process and merge updates

      // Placeholder: Pull policy updates
      const policiesUrl = `${apiBaseUrl}/api/sync/policies`;
      // const response = await fetch(policiesUrl);
      // Process policy updates

      logger.info("Pull updates not fully implemented");
    } catch (error) {
      logger.error("Failed to pull updates", error);
    }
  }
}

// Export singleton
export const syncService = new SyncService();
