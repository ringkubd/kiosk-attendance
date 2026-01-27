// Core domain types
export interface Employee {
  id: string;
  org_id: string;
  branch_id: string;
  name: string;
  code?: string;
  status: "active" | "inactive";
  embedding_avg?: Float32Array;
  embeddings_json?: string;
  updated_at: number;
  sync_state: "clean" | "dirty";
}

export interface AttendanceLog {
  id: string;
  org_id: string;
  branch_id: string;
  device_id: string;
  employee_id: string;
  type: "IN" | "OUT" | "BREAK_START" | "BREAK_END";
  ts_local: number;
  confidence: number;
  synced: number; // 0 or 1
  server_id?: string | null;
  created_at?: number;
}

export interface AttendanceLogWithEmployee extends AttendanceLog {
  employee_name: string;
}

export interface SyncQueueItem {
  id: string;
  entity_type: "employee" | "log";
  entity_id: string;
  payload_json: string;
  created_at: number;
  retry_count: number;
  last_error?: string;
}

export interface RecognitionResult {
  employeeId: string;
  employeeName: string;
  confidence: number;
  embedding: Float32Array;
}

export interface FaceDetectionResult {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
  };
  eyeOpenProbability?: {
    left: number;
    right: number;
  };
  headAngle?: {
    roll: number;
    yaw: number;
    pitch: number;
  };
}

export interface LivenessChallenge {
  type: "blink" | "turn-head-left";
  instruction: string;
}

export interface AppSettings {
  threshold: number;
  device_id: string;
  api_base_url: string;
  sync_enabled: boolean;
  sync_interval_minutes: number;
  admin_pin: string;
  active_org_id?: string;
  active_branch_id?: string;
}

export type KioskStatus = "READY" | "PROCESSING" | "SUCCESS" | "FAIL";

export interface AttendanceStats {
  totalIn: number;
  totalOut: number;
  date: string;
}
