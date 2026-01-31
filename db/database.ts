import * as SQLite from "expo-sqlite";
import type { AttendanceLog, Employee, SyncQueueItem } from "../types";
import { DB_NAME, DB_VERSION } from "../utils/constants";
import { Logger } from "../utils/logger";

const logger = new Logger("Database");

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(operation, operation);
  writeChain = next.catch(() => undefined);
  return next;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        db = await SQLite.openDatabaseAsync(DB_NAME);
        logger.info("Database opened successfully");

        await enqueueWrite(async () => {
          await db!.execAsync(
            "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
          );
        });

        await runMigrations(db);
        logger.info("Database migrations completed");

        return db;
      } catch (error: any) {
        const message = error?.message || "";
        if (message.includes("database is locked") && attempt < maxAttempts) {
          const delay = 200 * attempt;
          logger.warn(
            `Database locked during init (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        logger.error("Failed to initialize database", error);
        throw error;
      }
    }
    throw new Error("Failed to initialize database after retries");
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export async function ensureDefaultOrgBranchDevice(
  orgId: string,
  branchId: string,
  deviceId: string,
): Promise<void> {
  const database = getDatabase();
  const now = Date.now();
  await enqueueWrite(async () => {
    await database.runAsync(
      `INSERT OR IGNORE INTO orgs (id, name, api_base_url, sync_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, "Default Org", null, null, now, now],
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO branches (id, org_id, name, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [branchId, orgId, "Main Branch", "Asia/Dhaka", now, now],
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO devices (id, org_id, branch_id, name, registered_at, last_sync_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [deviceId, orgId, branchId, "Kiosk Device", now, null],
    );
  });
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check if migrations table exists
  await enqueueWrite(async () => {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);
  });

  // Get current version
  const result = await database.getAllAsync<{ version: number }>(
    "SELECT version FROM migrations ORDER BY version DESC LIMIT 1",
  );
  const currentVersion = result.length > 0 ? result[0].version : 0;

  logger.info(
    `Current DB version: ${currentVersion}, Target version: ${DB_VERSION}`,
  );

  // Apply migrations
  if (currentVersion < 1) {
    await migration_v1(database);
  }
  if (currentVersion < 2) {
    await migration_v2(database);
  }
  if (currentVersion < 3) {
    await migration_v3(database);
  }

  // Add future migrations here
  // if (currentVersion < 2) await migration_v2(database);
}

async function migration_v1(database: SQLite.SQLiteDatabase): Promise<void> {
  logger.info("Running migration v1");

  await enqueueWrite(async () => {
    await database.execAsync(`
    -- Employees table
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      status TEXT DEFAULT 'active',
      embedding_avg BLOB,
      embeddings_json TEXT,
      updated_at INTEGER NOT NULL,
      sync_state TEXT DEFAULT 'dirty'
    );

    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
    CREATE INDEX IF NOT EXISTS idx_employees_sync_state ON employees(sync_state);

    -- Attendance logs table
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
      ts_local INTEGER NOT NULL,
      confidence REAL NOT NULL,
      device_id TEXT NOT NULL,
      photo_path TEXT,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_logs(employee_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_ts ON attendance_logs(ts_local);
    CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance_logs(synced);

    -- Sync queue table
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('employee', 'log')),
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(retry_count);
  `);
  });

  await enqueueWrite(async () => {
    await database.runAsync(
      "INSERT INTO migrations (version, applied_at) VALUES (?, ?)",
      [1, Date.now()],
    );
  });

  logger.info("Migration v1 completed");
}

async function migration_v2(database: SQLite.SQLiteDatabase): Promise<void> {
  logger.info("Running migration v2");

  await enqueueWrite(async () => {
    await database.execAsync(`
      DROP TABLE IF EXISTS attendance_logs;
      DROP TABLE IF EXISTS employees;
      DROP TABLE IF EXISTS shifts;
      DROP TABLE IF EXISTS employee_shifts;
      DROP TABLE IF EXISTS daily_summaries;
      DROP TABLE IF EXISTS devices;
      DROP TABLE IF EXISTS branches;
      DROP TABLE IF EXISTS orgs;

      CREATE TABLE IF NOT EXISTS orgs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_base_url TEXT,
        sync_token TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        timezone TEXT DEFAULT 'Asia/Dhaka',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(org_id);

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        registered_at INTEGER NOT NULL,
        last_sync_at INTEGER,
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_devices_branch ON devices(branch_id);

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        code TEXT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        embedding_avg BLOB,
        embeddings_json TEXT,
        updated_at INTEGER NOT NULL,
        sync_state TEXT DEFAULT 'dirty',
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code_org ON employees(org_id, code);
      CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
      CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
      CREATE INDEX IF NOT EXISTS idx_employees_sync_state ON employees(sync_state);

      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        grace_in_min INTEGER DEFAULT 0,
        grace_out_min INTEGER DEFAULT 0,
        break_allowed INTEGER DEFAULT 0,
        ot_allowed INTEGER DEFAULT 0,
        ot_start_after_min INTEGER DEFAULT 0,
        ot_rounding_min INTEGER DEFAULT 0,
        min_work_for_present_min INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        sync_state TEXT DEFAULT 'dirty',
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(org_id);
      CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id);

      CREATE TABLE IF NOT EXISTS employee_shifts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        shift_id TEXT NOT NULL,
        effective_from TEXT NOT NULL,
        effective_to TEXT,
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_shifts_effective ON employee_shifts(effective_from, effective_to);

      CREATE TABLE IF NOT EXISTS attendance_logs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
        ts_local INTEGER NOT NULL,
        confidence REAL NOT NULL,
        synced INTEGER DEFAULT 0,
        server_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_logs(employee_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_ts ON attendance_logs(ts_local);
      CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance_logs(synced);
      CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_logs(branch_id);

      CREATE TABLE IF NOT EXISTS daily_summaries (
        org_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift_id TEXT,
        first_in_ts INTEGER,
        last_out_ts INTEGER,
        work_min INTEGER DEFAULT 0,
        late_min INTEGER DEFAULT 0,
        early_min INTEGER DEFAULT 0,
        ot_min INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, branch_id, employee_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);
    `);
  });

  await enqueueWrite(async () => {
    await database.runAsync(
      "INSERT INTO migrations (version, applied_at) VALUES (?, ?)",
      [2, Date.now()],
    );
  });

  logger.info("Migration v2 completed");
}

async function migration_v3(database: SQLite.SQLiteDatabase): Promise<void> {
  logger.info("Running migration v3");

  await enqueueWrite(async () => {
    await database.execAsync(`
      ALTER TABLE employees ADD COLUMN user_id TEXT;
      ALTER TABLE employees ADD COLUMN last_server_update INTEGER;

      ALTER TABLE attendance_logs ADD COLUMN server_log_id TEXT;
      ALTER TABLE attendance_logs ADD COLUMN sync_confirmed INTEGER DEFAULT 0;

      ALTER TABLE shifts ADD COLUMN working_days TEXT;
      ALTER TABLE shifts ADD COLUMN grace_period_minutes INTEGER DEFAULT 0;
    `);
  });

  await enqueueWrite(async () => {
    await database.runAsync(
      "INSERT INTO migrations (version, applied_at) VALUES (?, ?)",
      [3, Date.now()],
    );
  });

  logger.info("Migration v3 completed");
}

// Employee CRUD operations
export async function insertEmployee(
  employee: Omit<Employee, "updated_at" | "sync_state">,
): Promise<void> {
  const db = getDatabase();
  const embeddingBlob = employee.embedding_avg
    ? new Uint8Array(employee.embedding_avg.buffer)
    : null;

  await enqueueWrite(async () => {
    await db.runAsync(
      `INSERT INTO employees (id, org_id, branch_id, user_id, code, name, status, embedding_avg, embeddings_json, last_server_update, updated_at, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.id,
        employee.org_id,
        employee.branch_id,
        employee.user_id || null,
        employee.code || null,
        employee.name,
        employee.status,
        embeddingBlob,
        employee.embeddings_json || null,
        employee.last_server_update || null,
        Date.now(),
        "dirty",
      ],
    );
  });
  logger.info(`Inserted employee: ${employee.name}`);
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>,
): Promise<void> {
  const db = getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.org_id !== undefined) {
    fields.push("org_id = ?");
    values.push(updates.org_id);
  }
  if (updates.branch_id !== undefined) {
    fields.push("branch_id = ?");
    values.push(updates.branch_id);
  }
  if (updates.user_id !== undefined) {
    fields.push("user_id = ?");
    values.push(updates.user_id);
  }
  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.code !== undefined) {
    fields.push("code = ?");
    values.push(updates.code);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.embedding_avg !== undefined) {
    fields.push("embedding_avg = ?");
    values.push(
      updates.embedding_avg
        ? new Uint8Array(updates.embedding_avg.buffer)
        : null,
    );
  }
  if (updates.embeddings_json !== undefined) {
    fields.push("embeddings_json = ?");
    values.push(updates.embeddings_json);
  }
  if (updates.last_server_update !== undefined) {
    fields.push("last_server_update = ?");
    values.push(updates.last_server_update);
  }

  fields.push("updated_at = ?", "sync_state = ?");
  values.push(Date.now(), "dirty", id);

  await enqueueWrite(async () => {
    await db.runAsync(
      `UPDATE employees SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
  });
  logger.info(`Updated employee: ${id}`);
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const db = getDatabase();
  const result = await db.getAllAsync<any>(
    "SELECT * FROM employees WHERE id = ?",
    [id],
  );

  if (result.length === 0) return null;

  return rowToEmployee(result[0]);
}

export async function getAllActiveEmployees(
  orgId: string,
  branchId: string,
): Promise<Employee[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<any>(
    "SELECT * FROM employees WHERE status = 'active' AND org_id = ? AND branch_id = ?",
    [orgId, branchId],
  );

  return results.map(rowToEmployee);
}

export async function getAllActiveEmployeesUnfiltered(): Promise<Employee[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<any>(
    "SELECT * FROM employees WHERE status = 'active' ORDER BY name",
  );

  return results.map(rowToEmployee);
}

export async function getAllEmployees(
  orgId: string,
  branchId: string,
): Promise<Employee[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<any>(
    "SELECT * FROM employees WHERE org_id = ? AND branch_id = ? ORDER BY name",
    [orgId, branchId],
  );
  logger.debug(
    `[DB] getAllEmployees query: org_id="${orgId}", branch_id="${branchId}" -> returned ${results.length} employees`,
  );

  // Diagnostic: if no employees found, log all employees in DB to help debug
  if (results.length === 0) {
    try {
      const allEmps = await db.getAllAsync<any>(
        "SELECT id, org_id, branch_id, name FROM employees",
      );
      logger.warn(
        `[DB] Diagnostic: Total employees in database: ${allEmps.length}. All org/branch combinations:`,
        allEmps.map((e) => ({
          org_id: e.org_id,
          branch_id: e.branch_id,
          name: e.name,
        })),
      );
    } catch (diagError) {
      logger.debug("[DB] Could not run diagnostic query", diagError);
    }
  }

  return results.map(rowToEmployee);
}

export async function getAllEmployeesUnfiltered(): Promise<Employee[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<any>(
    "SELECT * FROM employees ORDER BY name",
  );
  logger.debug(
    `[DB] getAllEmployeesUnfiltered query -> returned ${results.length} employees`,
  );

  return results.map(rowToEmployee);
}

export async function deleteEmployee(id: string): Promise<void> {
  const db = getDatabase();
  await enqueueWrite(async () => {
    await db.runAsync("DELETE FROM employees WHERE id = ?", [id]);
  });
  logger.info(`Deleted employee: ${id}`);
}

function rowToEmployee(row: any): Employee {
  const embeddingBytes: Uint8Array | null = row.embedding_avg || null;
  const embedding =
    embeddingBytes && embeddingBytes.byteLength > 0
      ? new Float32Array(
          embeddingBytes.buffer,
          embeddingBytes.byteOffset,
          embeddingBytes.byteLength / Float32Array.BYTES_PER_ELEMENT,
        )
      : undefined;

  return {
    id: row.id,
    org_id: row.org_id,
    branch_id: row.branch_id,
    user_id: row.user_id || undefined,
    name: row.name,
    code: row.code,
    status: row.status,
    embedding_avg: embedding,
    embeddings_json: row.embeddings_json,
    last_server_update: row.last_server_update || undefined,
    updated_at: row.updated_at,
    sync_state: row.sync_state,
  };
}

// Attendance Log operations
export async function insertAttendanceLog(
  log: Omit<AttendanceLog, "id" | "synced">,
): Promise<string> {
  const db = getDatabase();
  const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await enqueueWrite(async () => {
    await db.runAsync(
      `INSERT INTO attendance_logs (id, org_id, branch_id, device_id, employee_id, type, ts_local, confidence, synced, sync_confirmed, server_id, server_log_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
      [
        id,
        log.org_id,
        log.branch_id,
        log.device_id,
        log.employee_id,
        log.type,
        log.ts_local,
        log.confidence,
        log.server_id || null,
        log.server_log_id || log.server_id || null,
        log.created_at || Date.now(),
      ],
    );
  });

  logger.info(`Inserted attendance log: ${id} (${log.type})`);
  return id;
}

export async function getAttendanceLogsByDateRange(
  orgId: string,
  branchId: string,
  startTs: number,
  endTs: number,
): Promise<AttendanceLog[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<AttendanceLog>(
    "SELECT * FROM attendance_logs WHERE org_id = ? AND branch_id = ? AND ts_local >= ? AND ts_local <= ? ORDER BY ts_local DESC",
    [orgId, branchId, startTs, endTs],
  );
  return results;
}

export async function getAttendanceLogsWithEmployeeByDateRange(
  orgId: string,
  branchId: string,
  startTs: number,
  endTs: number,
): Promise<(AttendanceLog & { employee_name: string })[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<
    AttendanceLog & { employee_name: string }
  >(
    `
    SELECT attendance_logs.*, employees.name as employee_name
    FROM attendance_logs
    LEFT JOIN employees ON employees.id = attendance_logs.employee_id
    WHERE attendance_logs.org_id = ? AND attendance_logs.branch_id = ?
      AND attendance_logs.ts_local >= ? AND attendance_logs.ts_local <= ?
    ORDER BY attendance_logs.ts_local DESC
    `,
    [orgId, branchId, startTs, endTs],
  );
  return results.map((row) => ({
    ...row,
    employee_name: row.employee_name || "Unknown",
  }));
}

export async function getLastAttendanceLogForEmployee(
  orgId: string,
  branchId: string,
  employeeId: string,
  startOfDay: number,
): Promise<AttendanceLog | null> {
  const db = getDatabase();
  const results = await db.getAllAsync<AttendanceLog>(
    "SELECT * FROM attendance_logs WHERE org_id = ? AND branch_id = ? AND employee_id = ? AND ts_local >= ? ORDER BY ts_local DESC LIMIT 1",
    [orgId, branchId, employeeId, startOfDay],
  );
  return results.length > 0 ? results[0] : null;
}

export async function getRecentAttendanceLogForEmployee(
  orgId: string,
  branchId: string,
  employeeId: string,
  withinSeconds: number,
): Promise<AttendanceLog | null> {
  const db = getDatabase();
  const cutoff = Date.now() - withinSeconds * 1000;
  const results = await db.getAllAsync<AttendanceLog>(
    "SELECT * FROM attendance_logs WHERE org_id = ? AND branch_id = ? AND employee_id = ? AND ts_local >= ? ORDER BY ts_local DESC LIMIT 1",
    [orgId, branchId, employeeId, cutoff],
  );
  return results.length > 0 ? results[0] : null;
}

export async function getUnsyncedAttendanceLogs(
  orgId: string,
  branchId: string,
  limit: number = 200,
): Promise<AttendanceLog[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<AttendanceLog>(
    "SELECT * FROM attendance_logs WHERE org_id = ? AND branch_id = ? AND synced = 0 ORDER BY ts_local ASC LIMIT ?",
    [orgId, branchId, limit],
  );
  return results;
}

export async function markAttendanceLogsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await enqueueWrite(async () => {
    await db.runAsync(
      `UPDATE attendance_logs SET synced = 1 WHERE id IN (${placeholders})`,
      ids,
    );
  });
  logger.info(`Marked ${ids.length} logs as synced`);
}

export async function updateAttendanceLogsServerInfo(
  updates: {
    id: string;
    server_log_id?: string | null;
    sync_confirmed?: number;
  }[],
): Promise<void> {
  if (updates.length === 0) return;
  const db = getDatabase();

  await enqueueWrite(async () => {
    for (const update of updates) {
      const fields: string[] = [];
      const values: any[] = [];
      if (update.server_log_id !== undefined) {
        fields.push("server_log_id = ?", "server_id = ?");
        values.push(update.server_log_id, update.server_log_id);
      }
      if (update.sync_confirmed !== undefined) {
        fields.push("sync_confirmed = ?");
        values.push(update.sync_confirmed);
      }
      if (fields.length === 0) continue;
      values.push(update.id);
      await db.runAsync(
        `UPDATE attendance_logs SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
    }
  });
}

export async function upsertEmployeeFromServer(
  employee: Omit<Employee, "sync_state" | "embedding_avg"> & {
    embedding_avg?: Float32Array;
  },
): Promise<void> {
  const db = getDatabase();
  const existing = await db.getAllAsync<any>(
    "SELECT embedding_avg, embeddings_json FROM employees WHERE id = ?",
    [employee.id],
  );
  const existingEmbedding =
    existing.length > 0 ? existing[0].embedding_avg : null;
  const existingEmbeddingsJson =
    existing.length > 0 ? existing[0].embeddings_json : null;

  const embeddingBlob = employee.embedding_avg
    ? new Uint8Array(employee.embedding_avg.buffer)
    : existingEmbedding;
  const embeddingsJson =
    employee.embeddings_json !== undefined
      ? employee.embeddings_json
      : existingEmbeddingsJson;

  await enqueueWrite(async () => {
    await db.runAsync(
      `
      INSERT INTO employees (
        id, org_id, branch_id, user_id, code, name, status, embedding_avg, embeddings_json,
        last_server_update, updated_at, sync_state
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        org_id = excluded.org_id,
        branch_id = excluded.branch_id,
        user_id = excluded.user_id,
        code = excluded.code,
        name = excluded.name,
        status = excluded.status,
        embedding_avg = excluded.embedding_avg,
        embeddings_json = excluded.embeddings_json,
        last_server_update = excluded.last_server_update,
        updated_at = excluded.updated_at,
        sync_state = 'clean'
      `,
      [
        employee.id,
        employee.org_id,
        employee.branch_id,
        employee.user_id || null,
        employee.code || null,
        employee.name,
        employee.status,
        embeddingBlob,
        embeddingsJson,
        employee.last_server_update || employee.updated_at || Date.now(),
        employee.updated_at || Date.now(),
        "clean",
      ],
    );
    logger.debug(
      `[DB] Upserted employee: id=${employee.id}, org_id=${employee.org_id}, branch_id=${employee.branch_id}, name=${employee.name}, isInsert=${existing.length === 0}`,
    );
  });
}

export async function upsertShift(shift: {
  id: string;
  org_id: string;
  branch_id?: string | null;
  name: string;
  start_time: string;
  end_time: string;
  grace_in_min?: number;
  grace_out_min?: number;
  grace_period_minutes?: number;
  working_days?: string | null;
  updated_at: number;
}): Promise<void> {
  const db = getDatabase();
  await enqueueWrite(async () => {
    await db.runAsync(
      `
      INSERT INTO shifts (
        id, org_id, branch_id, name, start_time, end_time, grace_in_min, grace_out_min,
        grace_period_minutes, working_days, updated_at, sync_state
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        org_id = excluded.org_id,
        branch_id = excluded.branch_id,
        name = excluded.name,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        grace_in_min = excluded.grace_in_min,
        grace_out_min = excluded.grace_out_min,
        grace_period_minutes = excluded.grace_period_minutes,
        working_days = excluded.working_days,
        updated_at = excluded.updated_at,
        sync_state = 'clean'
      `,
      [
        shift.id,
        shift.org_id,
        shift.branch_id || null,
        shift.name,
        shift.start_time,
        shift.end_time,
        shift.grace_in_min || 0,
        shift.grace_out_min || 0,
        shift.grace_period_minutes || 0,
        shift.working_days || null,
        shift.updated_at,
        "clean",
      ],
    );
  });
}

export async function replaceEmployeeShifts(
  employeeId: string,
  shifts: {
    id: string;
    org_id: string;
    shift_id: string;
    effective_from: string;
    effective_to?: string | null;
  }[],
): Promise<void> {
  const db = getDatabase();
  await enqueueWrite(async () => {
    await db.runAsync("DELETE FROM employee_shifts WHERE employee_id = ?", [
      employeeId,
    ]);

    for (const shift of shifts) {
      await db.runAsync(
        `INSERT INTO employee_shifts (id, org_id, employee_id, shift_id, effective_from, effective_to)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          shift.id,
          shift.org_id,
          employeeId,
          shift.shift_id,
          shift.effective_from,
          shift.effective_to || null,
        ],
      );
    }
  });
}

// Sync Queue operations
export async function addToSyncQueue(
  item: Omit<SyncQueueItem, "id" | "created_at" | "retry_count">,
): Promise<void> {
  const db = getDatabase();
  const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await enqueueWrite(async () => {
    await db.runAsync(
      `INSERT INTO sync_queue (id, entity_type, entity_id, payload_json, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, item.entity_type, item.entity_id, item.payload_json, Date.now()],
    );
  });
}

export async function getSyncQueueItems(
  limit: number = 50,
): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  const results = await db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?",
    [limit],
  );
  return results;
}

export async function updateSyncQueueItem(
  id: string,
  retryCount: number,
  error?: string,
): Promise<void> {
  const db = getDatabase();
  await enqueueWrite(async () => {
    await db.runAsync(
      "UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?",
      [retryCount, error || null, id],
    );
  });
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = getDatabase();
  await enqueueWrite(async () => {
    await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
  });
}
