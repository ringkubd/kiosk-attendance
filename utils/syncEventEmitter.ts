// Event emitter for sync notifications
import { EventEmitter } from "eventemitter3";

export type SyncEventType =
  | "employees_synced"
  | "logs_synced"
  | "shifts_synced"
  | "sync_complete";

class SyncEventEmitter extends EventEmitter {
  notifyEmployeesSynced(count: number): void {
    this.emit("employees_synced", count);
  }

  notifyLogsSynced(count: number): void {
    this.emit("logs_synced", count);
  }

  notifyShiftsSynced(count: number): void {
    this.emit("shifts_synced", count);
  }

  notifySyncComplete(): void {
    this.emit("sync_complete");
  }

  onEmployeesSynced(callback: (count: number) => void): () => void {
    this.on("employees_synced", callback);
    return () => this.off("employees_synced", callback);
  }

  onLogsSynced(callback: (count: number) => void): () => void {
    this.on("logs_synced", callback);
    return () => this.off("logs_synced", callback);
  }

  onShiftsSynced(callback: (count: number) => void): () => void {
    this.on("shifts_synced", callback);
    return () => this.off("shifts_synced", callback);
  }

  onSyncComplete(callback: () => void): () => void {
    this.on("sync_complete", callback);
    return () => this.off("sync_complete", callback);
  }
}

export const syncEventEmitter = new SyncEventEmitter();
