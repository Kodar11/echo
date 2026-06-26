import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getUserDataPath } from '../electron/pathResolver.js';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';

let db: Database.Database | null = null;
let overridePath: string | null = null;

export function setDatabasePath(dbPath: string): void {
  overridePath = dbPath;
  if (db) {
    db.close();
    db = null;
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
    db = new Database(overridePath ?? getDatabasePath());
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA_SQL);
    runMigrations(db);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
