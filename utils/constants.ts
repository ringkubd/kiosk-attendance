// Constants
export const PRIMARY_COLOR = "#CE4631";
export const PRIMARY_GRADIENT_START = "#CE4631";
export const PRIMARY_GRADIENT_END = "#E56551";
export const ACCENT_COLOR = "#F57C00";
export const SECONDARY_COLOR = "#FCE8E5";
export const TEXT_PRIMARY = "#0F172A";
export const TEXT_SECONDARY = "#64748B";
export const ERROR_COLOR = "#DC2626";
export const SUCCESS_COLOR = "#16A34A";
export const WARNING_COLOR = "#F59E0B";
export const INFO_COLOR = "#2563EB";
export const BACKGROUND_COLOR = "#F7F9FC";
export const SURFACE_COLOR = "#FFFFFF";
export const BORDER_COLOR = "#E2E8F0";

// Face recognition
export const FACE_SIZE = 112;
export const MODEL_INPUT_SHAPE = [1, 3, 112, 112];
export const MIN_FACE_SIZE = 80;
export const RECOGNITION_THRESHOLD = 0.55;
export const EMBEDDING_SIZE = 128;
export const ENROLL_DUPLICATE_THRESHOLD = 0.7;

// Liveness
export const LIVENESS_FRAMES_REQUIRED = 3;
export const LIVENESS_TIMEOUT_MS = 6000;

// Database
export const DB_NAME = "kiosk_attendance.db";
export const DB_VERSION = 3;

// Attendance
export const DUPLICATE_WINDOW_SECONDS = 120;

// Sync
export const SYNC_INTERVAL_MS = 300000; // 5 minutes
export const SYNC_BATCH_SIZE = 200;
export const SYNC_RETRY_BASE_DELAY = 2000;
export const SYNC_RETRY_MAX = 5;

// Admin
export const DEFAULT_ADMIN_PIN = "1234";
export const ADMIN_PIN_KEY = "admin_pin";

// Settings
export const SETTINGS_KEYS = {
  THRESHOLD: "recognition_threshold",
  DEVICE_ID: "device_id",
  API_BASE_URL: "api_base_url",
  SYNC_ENABLED: "sync_enabled",
  SYNC_INTERVAL: "sync_interval",
  ACTIVE_ORG_ID: "active_org_id",
  ACTIVE_BRANCH_ID: "active_branch_id",
} as const;
