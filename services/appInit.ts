// App initialization service
import { ensureDefaultOrgBranchDevice, initDatabase } from "../db/database";
import { faceRecognitionService } from "../ml/faceRecognition";
import { initializeSettings } from "../services/settings";
import { syncService } from "../services/sync";
import { Logger } from "../utils/logger";

const logger = new Logger("AppInit");

let initialized = false;

/**
 * Initialize the application
 * Call this once at app startup
 */
export async function initializeApp(): Promise<void> {
  if (initialized) {
    logger.info("App already initialized");
    return;
  }

  try {
    logger.info("Initializing application...");

    // 1. Initialize database
    logger.info("Initializing database...");
    await initDatabase();

    // 2. Initialize settings
    logger.info("Initializing settings...");
    await initializeSettings();

    const settings = await import("../services/settings").then((m) =>
      m.getSettings(),
    );
    if (settings.active_org_id && settings.active_branch_id && settings.device_id) {
      await ensureDefaultOrgBranchDevice(
        settings.active_org_id,
        settings.active_branch_id,
        settings.device_id,
      );
    }

    // 3. Initialize face recognition service (non-fatal)
    logger.info("Initializing face recognition...");
    try {
      await faceRecognitionService.initialize();
    } catch (err: any) {
      logger.warn(
        "Face recognition service failed to initialize; continuing without face recognition:",
        err.message || err,
      );
    }

    // 4. Start background sync (if configured)
    logger.info("Checking sync configuration...");
    if (
      settings.sync_enabled &&
      settings.api_base_url &&
      settings.sync_interval_minutes > 0
    ) {
      logger.info("Starting background sync...");
      syncService.startBackgroundSync(settings.sync_interval_minutes);
    }

    initialized = true;
    logger.info("Application initialized successfully");
  } catch (error) {
    logger.error("Application initialization failed", error);
    throw error;
  }
}

/**
 * Check if app is initialized
 */
export function isAppInitialized(): boolean {
  return initialized;
}

/**
 * Cleanup app resources
 */
export function cleanupApp(): void {
  logger.info("Cleaning up application...");
  syncService.stopBackgroundSync();
  initialized = false;
}
