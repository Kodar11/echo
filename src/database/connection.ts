import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getUserDataPath } from '../electron/pathResolver.js';
import { SCHEMA_SQL } from './schema.js';

let db: Database.Database | null = null;
let overridePath: string | null = null;

export function setDatabasePath(dbPath: string): void {
  overridePath = dbPath;
  if (db) {
    closeDatabaseInternal();
  }
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
    db = openDatabase();
  }
  return db;
}

function openDatabase(): Database.Database {
  const database = new Database(overridePath ?? getDatabasePath());

  // Reliability pragmas.
  database.pragma('journal_mode = WAL');
  database.pragma('synchronous = NORMAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('foreign_keys = ON');

  database.exec(SCHEMA_SQL);

  return database;
}

export function closeDatabase(): void {
  closeDatabaseInternal();
}

function closeDatabaseInternal(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore checkpoint failures during shutdown.
    }
    db.close();
    db = null;
  }
}
