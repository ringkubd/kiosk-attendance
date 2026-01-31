import * as SecureStore from "expo-secure-store";
import type { AppSettings } from "../types";
import { RECOGNITION_THRESHOLD } from "../utils/constants";
import { Logger } from "../utils/logger";

const logger = new Logger("Settings");

const KEYS = {
  THRESHOLD: "settings_threshold",
  DEVICE_ID: "settings_device_id",
  DEVICE_TOKEN: "settings_device_token",
  API_BASE_URL: "settings_api_base_url",
  SYNC_ENABLED: "settings_sync_enabled",
  ATTENDANCE_IMMEDIATE_SYNC: "settings_attendance_immediate_sync",
  VOICE_FEEDBACK_ENABLED: "settings_voice_feedback_enabled",
  SYNC_INTERVAL: "settings_sync_interval",
  ADMIN_PIN: "settings_admin_pin",
  ACTIVE_ORG_ID: "settings_active_org_id",
  ACTIVE_BRANCH_ID: "settings_active_branch_id",
  LAST_SYNC_EMPLOYEES: "settings_last_sync_employees",
  LAST_SYNC_SHIFTS: "settings_last_sync_shifts",
};

const DEFAULT_PIN = "123456"; // Initial default PIN

export async function initializeSettings(): Promise<void> {
  try {
    // Initialize device_id if not exists
    let deviceId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
      logger.info("Generated new device ID");
    }

    // Initialize admin PIN if not exists
    const adminPin = await SecureStore.getItemAsync(KEYS.ADMIN_PIN);
    if (!adminPin) {
      await SecureStore.setItemAsync(KEYS.ADMIN_PIN, DEFAULT_PIN);
      logger.info("Initialized default admin PIN");
    }

    // Initialize other defaults
    const threshold = await SecureStore.getItemAsync(KEYS.THRESHOLD);
    if (!threshold) {
      await SecureStore.setItemAsync(
        KEYS.THRESHOLD,
        RECOGNITION_THRESHOLD.toString(),
      );
    }

    const syncInterval = await SecureStore.getItemAsync(KEYS.SYNC_INTERVAL);
    if (!syncInterval) {
      await SecureStore.setItemAsync(KEYS.SYNC_INTERVAL, "15"); // 15 minutes default
    }

    const syncEnabled = await SecureStore.getItemAsync(KEYS.SYNC_ENABLED);
    if (!syncEnabled) {
      await SecureStore.setItemAsync(KEYS.SYNC_ENABLED, "true");
    }

    const immediateSync = await SecureStore.getItemAsync(
      KEYS.ATTENDANCE_IMMEDIATE_SYNC,
    );
    if (!immediateSync) {
      await SecureStore.setItemAsync(KEYS.ATTENDANCE_IMMEDIATE_SYNC, "false");
    }

    const voiceFeedback = await SecureStore.getItemAsync(
      KEYS.VOICE_FEEDBACK_ENABLED,
    );
    if (!voiceFeedback) {
      await SecureStore.setItemAsync(KEYS.VOICE_FEEDBACK_ENABLED, "true");
    }

    const activeOrgId = await SecureStore.getItemAsync(KEYS.ACTIVE_ORG_ID);
    if (!activeOrgId) {
      const newOrgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await SecureStore.setItemAsync(KEYS.ACTIVE_ORG_ID, newOrgId);
      logger.info("Initialized active org ID");
    }

    const activeBranchId = await SecureStore.getItemAsync(
      KEYS.ACTIVE_BRANCH_ID,
    );
    if (!activeBranchId) {
      const newBranchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await SecureStore.setItemAsync(KEYS.ACTIVE_BRANCH_ID, newBranchId);
      logger.info("Initialized active branch ID");
    }

    logger.info("Settings initialized");
  } catch (error) {
    logger.error("Failed to initialize settings", error);
    throw error;
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const [
      threshold,
      deviceId,
      deviceToken,
      apiBaseUrl,
      syncInterval,
      adminPin,
      syncEnabled,
      immediateSync,
      voiceFeedback,
      activeOrgId,
      activeBranchId,
    ] = await Promise.all([
      SecureStore.getItemAsync(KEYS.THRESHOLD),
      SecureStore.getItemAsync(KEYS.DEVICE_ID),
      SecureStore.getItemAsync(KEYS.DEVICE_TOKEN),
      SecureStore.getItemAsync(KEYS.API_BASE_URL),
      SecureStore.getItemAsync(KEYS.SYNC_INTERVAL),
      SecureStore.getItemAsync(KEYS.ADMIN_PIN),
      SecureStore.getItemAsync(KEYS.SYNC_ENABLED),
      SecureStore.getItemAsync(KEYS.ATTENDANCE_IMMEDIATE_SYNC),
      SecureStore.getItemAsync(KEYS.VOICE_FEEDBACK_ENABLED),
      SecureStore.getItemAsync(KEYS.ACTIVE_ORG_ID),
      SecureStore.getItemAsync(KEYS.ACTIVE_BRANCH_ID),
    ]);

    return {
      threshold: parseFloat(threshold || RECOGNITION_THRESHOLD.toString()),
      device_id: deviceId || "",
      device_token: deviceToken || undefined,
      api_base_url: apiBaseUrl || "",
      sync_enabled: syncEnabled === "true",
      attendance_immediate_sync: immediateSync === "true",
      voice_feedback_enabled: voiceFeedback === "true",
      sync_interval_minutes: parseInt(syncInterval || "15", 10),
      admin_pin: adminPin || DEFAULT_PIN,
      active_org_id: activeOrgId || undefined,
      active_branch_id: activeBranchId || undefined,
    };
  } catch (error) {
    logger.error("Failed to get settings", error);
    throw error;
  }
}

export async function updateThreshold(value: number): Promise<void> {
  await SecureStore.setItemAsync(KEYS.THRESHOLD, value.toString());
  logger.info(`Updated threshold to ${value}`);
}

export async function updateApiBaseUrl(url: string): Promise<void> {
  const value = String(url).trim();
  if (!value) throw new Error("API URL cannot be empty");
  await SecureStore.setItemAsync(KEYS.API_BASE_URL, value);
  logger.info("Updated API base URL");
}

export async function updateSyncEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SYNC_ENABLED, enabled.toString());
  logger.info(`Updated sync enabled to ${enabled}`);
}

export async function updateAttendanceImmediateSync(
  enabled: boolean,
): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.ATTENDANCE_IMMEDIATE_SYNC,
    enabled.toString(),
  );
  logger.info(`Updated attendance immediate sync to ${enabled}`);
}

export async function updateVoiceFeedbackEnabled(
  enabled: boolean,
): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.VOICE_FEEDBACK_ENABLED,
    enabled.toString(),
  );
  logger.info(`Updated voice feedback to ${enabled}`);
}

export async function updateSyncInterval(minutes: number): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SYNC_INTERVAL, minutes.toString());
  logger.info(`Updated sync interval to ${minutes} minutes`);
}

export async function updateAdminPin(newPin: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ADMIN_PIN, newPin);
  logger.info("Updated admin PIN");
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const storedPin = await SecureStore.getItemAsync(KEYS.ADMIN_PIN);
    return storedPin === pin;
  } catch (error) {
    logger.error("Failed to verify PIN", error);
    return false;
  }
}

export async function getDeviceId(): Promise<string> {
  const deviceId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);
  if (!deviceId) {
    throw new Error("Device ID not initialized");
  }
  return deviceId;
}

export async function setDeviceId(deviceId: string): Promise<void> {
  const value = String(deviceId).trim();
  if (!value) throw new Error("Device ID cannot be empty");
  await SecureStore.setItemAsync(KEYS.DEVICE_ID, value);
  logger.info("Updated device ID");
}

export async function regenerateDeviceId(): Promise<string> {
  const newDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await SecureStore.setItemAsync(KEYS.DEVICE_ID, newDeviceId);
  logger.info("Regenerated device ID");
  return newDeviceId;
}

export async function getActiveOrgBranchIds(): Promise<{
  orgId: string;
  branchId: string;
}> {
  const [orgId, branchId] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACTIVE_ORG_ID),
    SecureStore.getItemAsync(KEYS.ACTIVE_BRANCH_ID),
  ]);
  if (!orgId || !branchId) {
    throw new Error("Active org/branch not initialized");
  }
  return { orgId, branchId };
}

export async function setActiveOrgBranchIds(
  orgId: string,
  branchId: string,
): Promise<void> {
  const orgValue = String(orgId).trim();
  const branchValue = String(branchId).trim();
  if (!orgValue) throw new Error("Org ID cannot be empty");
  if (!branchValue) throw new Error("Branch ID cannot be empty");
  await SecureStore.setItemAsync(KEYS.ACTIVE_ORG_ID, orgValue);
  await SecureStore.setItemAsync(KEYS.ACTIVE_BRANCH_ID, branchValue);
  logger.info("Updated active org/branch");
}

export async function setDeviceToken(token: string): Promise<void> {
  const value = String(token).trim();
  if (!value) throw new Error("Device token cannot be empty");
  await SecureStore.setItemAsync(KEYS.DEVICE_TOKEN, value);
  logger.info("Updated device token");
}

export async function getDeviceToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.DEVICE_TOKEN);
}

export async function getLastSyncTimestamp(
  entity: "employees" | "shifts",
): Promise<number> {
  const key =
    entity === "employees" ? KEYS.LAST_SYNC_EMPLOYEES : KEYS.LAST_SYNC_SHIFTS;
  const value = await SecureStore.getItemAsync(key);
  return value ? parseInt(value, 10) : 0;
}

export async function setLastSyncTimestamp(
  entity: "employees" | "shifts",
  timestamp: number,
): Promise<void> {
  const key =
    entity === "employees" ? KEYS.LAST_SYNC_EMPLOYEES : KEYS.LAST_SYNC_SHIFTS;
  await SecureStore.setItemAsync(key, timestamp.toString());
}
