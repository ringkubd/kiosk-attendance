// Sync service - handles background sync with API
import NetInfo from "@react-native-community/netinfo";
import
  {
    getAllEmployees,
    getUnsyncedAttendanceLogs,
    markAttendanceLogsSynced,
  } from "../db/database";
import type { AttendanceLog, Employee } from "../types";
import
  {
    SYNC_BATCH_SIZE,
    SYNC_RETRY_BASE_DELAY,
    SYNC_RETRY_MAX,
  } from "../utils/constants";
import { Logger } from "../utils/logger";
import { getActiveOrgBranchIds, getSettings } from "./settings";

const logger = new Logger("SyncService");

export interface SyncResult {
  success: boolean;
  syncedLogs: number;
  syncedEmployees: number;
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
   * Perform sync operation
   */
  async performSync(): Promise<SyncResult> {
    if (this.syncing) {
      logger.info("Sync already in progress, skipping");
      return {
        success: false,
        syncedLogs: 0,
        syncedEmployees: 0,
        errors: ["Sync already in progress"],
      };
    }

    this.syncing = true;
    const result: SyncResult = {
      success: true,
      syncedLogs: 0,
      syncedEmployees: 0,
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

      logger.info("Starting sync...");

      // Sync attendance logs
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const logsSynced = await this.syncAttendanceLogs(
        settings.api_base_url,
        orgId,
        branchId,
      );
      result.syncedLogs = logsSynced;

      // Sync employees (optional - only if dirty)
      const employeesSynced = await this.syncEmployees(
        settings.api_base_url,
        orgId,
        branchId,
      );
      result.syncedEmployees = employeesSynced;

      logger.info(
        `Sync completed: ${result.syncedLogs} logs, ${result.syncedEmployees} employees`,
      );
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
      const response = await this.sendLogsToAPI(apiBaseUrl, unsyncedLogs);

      if (response.success) {
        // Mark as synced
        const logIds = unsyncedLogs.map((log) => log.id);
        await markAttendanceLogsSynced(logIds);
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
   * Sync dirty employees to API
   */
  private async syncEmployees(
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
   * Send logs to API with retry logic
   */
  private async sendLogsToAPI(
    apiBaseUrl: string,
    logs: AttendanceLog[],
    retryCount: number = 0,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${apiBaseUrl}/api/sync/logs`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logs }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true };
    } catch (error: any) {
      logger.error(
        `API request failed (attempt ${retryCount + 1}/${SYNC_RETRY_MAX})`,
        error,
      );

      // Retry with exponential backoff
      if (retryCount < SYNC_RETRY_MAX) {
        const delay = SYNC_RETRY_BASE_DELAY * Math.pow(2, retryCount);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendLogsToAPI(apiBaseUrl, logs, retryCount + 1);
      }

      return { success: false, error: error.message };
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

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ employees: employeeData }),
        signal: AbortSignal.timeout(15000),
      });

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
