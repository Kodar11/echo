import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getUserDataPath } from '../electron/pathResolver.js';
import { runMigrations } from '../services/migration/MigrationManager.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { getUserVersion, hasUserTables, validateSchema } from './schemaValidation.js';

/**
 * What happened when the database was opened. The index is derived data, so an
 * incompatible database (pre-versioning legacy layout, a newer schema, a failed
 * migration, or a schema that is missing tables/columns) is rebuilt from
 * scratch instead of being repaired. A compatible database is never wiped.
 */
export interface DatabaseOpenReport {
  action: 'opened' | 'created' | 'migrated' | 'reset';
  schemaVersion: number;
  reason?: string;
  appliedMigrations?: number[];
}

class IncompatibleDatabaseError extends Error {}

let db: Database.Database | null = null;
let overridePath: string | null = null;
let lastOpenReport: DatabaseOpenReport | null = null;

export function setDatabasePath(dbPath: string): void {
  closeDatabaseInternal();
  overridePath = dbPath;
}

export function getDatabasePath(): string {
  if (overridePath) return overridePath;
  const userData = getUserDataPath();
  const dbDir = path.join(userData, 'echo');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'echo.db');
}

export function getDatabase(): Database.Database {
  if (!db) {
    db = openDatabase(getDatabasePath());
  }
  return db;
}

export function isDatabaseOpen(): boolean {
  return db !== null;
}

export function getLastOpenReport(): DatabaseOpenReport | null {
  return lastOpenReport;
}

/**
 * Deliberately discards the whole database (index, folders, settings) and
 * recreates an empty one from the canonical schema. Callers must make sure no
 * indexing session is using the database.
 */
export function resetDatabase(): DatabaseOpenReport {
  const dbPath = getDatabasePath();
  closeDatabaseInternal();
  deleteDatabaseFiles(dbPath);
  db = openDatabase(dbPath);
  lastOpenReport = {
    action: 'reset',
    schemaVersion: SCHEMA_VERSION,
    reason: 'Reset requested',
  };
  return lastOpenReport;
}

export function closeDatabase(): void {
  closeDatabaseInternal();
}

function openDatabase(dbPath: string): Database.Database {
  try {
    return openAndPrepare(dbPath);
  } catch (err) {
    if (!(err instanceof IncompatibleDatabaseError)) throw err;
    // One deliberate rebuild. If a freshly created database also fails, the
    // error propagates instead of looping.
    deleteDatabaseFiles(dbPath);
    const database = openAndPrepare(dbPath);
    lastOpenReport = {
      action: 'reset',
      schemaVersion: SCHEMA_VERSION,
      reason: `Incompatible database was rebuilt: ${err.message}`,
    };
    return database;
  }
}

function openAndPrepare(dbPath: string): Database.Database {
  const database = new Database(dbPath);
  try {
    applyPragmas(database);

    const version = getUserVersion(database);
    let report: DatabaseOpenReport;

    if (version === 0) {
      if (hasUserTables(database)) {
        throw new IncompatibleDatabaseError(
          'legacy database without a schema version'
        );
      }
      createFreshSchema(database);
      report = { action: 'created', schemaVersion: SCHEMA_VERSION };
    } else if (version > SCHEMA_VERSION) {
      throw new IncompatibleDatabaseError(
        `database schema version ${version} is newer than supported version ${SCHEMA_VERSION}`
      );
    } else if (version < SCHEMA_VERSION) {
      const result = runMigrations(database);
      if (!result.success) {
        throw new IncompatibleDatabaseError(result.error ?? 'migration failed');
      }
      report = {
        action: 'migrated',
        schemaVersion: result.currentVersion,
        appliedMigrations: result.applied,
      };
    } else {
      report = { action: 'opened', schemaVersion: version };
    }

    const validation = validateSchema(database);
    if (!validation.compatible) {
      throw new IncompatibleDatabaseError(validation.problems.join('; '));
    }

    // Idempotent: restores any secondary index that may have been dropped.
    database.exec(SCHEMA_SQL);
    ensureMetadataRow(database);

    lastOpenReport = report;
    return database;
  } catch (err) {
    database.close();
    throw err;
  }
}

function applyPragmas(database: Database.Database): void {
  database.pragma('journal_mode = WAL');
  database.pragma('synchronous = NORMAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('foreign_keys = ON');
}

function createFreshSchema(database: Database.Database): void {
  database.transaction(() => {
    database.exec(SCHEMA_SQL);
    database
      .prepare(
        'INSERT INTO Migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, NULL)'
      )
      .run(SCHEMA_VERSION, 'baseline', Date.now());
    ensureMetadataRow(database);
    database.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}

function ensureMetadataRow(database: Database.Database): void {
  database
    .prepare(
      `INSERT OR IGNORE INTO IndexMetadata (id, status, schema_version, created_at)
       VALUES (1, 'never_indexed', ?, ?)`
    )
    .run(SCHEMA_VERSION, Date.now());
}

function deleteDatabaseFiles(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

function closeDatabaseInternal(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // A failed checkpoint only leaves the WAL file for the next open.
    }
    db.close();
    db = null;
  }
}
