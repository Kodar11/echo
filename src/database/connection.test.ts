import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  closeDatabase,
  getDatabase,
  getLastOpenReport,
  resetDatabase,
  setDatabasePath,
} from './connection.js';
import { addFolder, getFolders } from './folders.js';
import { getIndexMetadata } from './indexMetadata.js';
import { SCHEMA_VERSION } from './schema.js';
import { validateSchema } from './schemaValidation.js';
import { IntegrityManager } from '../services/integrity/IntegrityManager.js';

function count(table: string): number {
  return (getDatabase().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

describe('database connection lifecycle', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-conn-'));
    dbPath = path.join(dir, 'echo.db');
    setDatabasePath(dbPath);
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a clean, valid, empty database from scratch', () => {
    const db = getDatabase();
    expect(getLastOpenReport()?.action).toBe('created');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(validateSchema(db)).toEqual({ compatible: true, problems: [] });

    for (const table of ['Files', 'Terms', 'Postings', 'IndexingFailures', 'IndexingRuns', 'IndexedFolders', 'IndexLock']) {
      expect(count(table)).toBe(0);
    }
    expect(count('IndexMetadata')).toBe(1);

    const meta = getIndexMetadata();
    expect(meta.status).toBe('never_indexed');
    expect(meta.last_synced_at).toBeNull();
    expect(meta.schema_version).toBe(SCHEMA_VERSION);

    const migrations = db.prepare('SELECT version FROM Migrations').all();
    expect(migrations).toEqual([{ version: SCHEMA_VERSION }]);
  });

  it('a fresh database passes the integrity check with zero issues', () => {
    getDatabase();
    const report = new IntegrityManager().verify();
    expect(report.issues).toEqual([]);
    expect(report.healthy).toBe(true);
  });

  it('keeps data when reopening a compatible database', () => {
    getDatabase();
    addFolder(dir);
    closeDatabase();

    getDatabase();
    expect(getLastOpenReport()?.action).toBe('opened');
    expect(getFolders()).toHaveLength(1);
  });

  it('rebuilds a legacy database that claims migrations ran but lacks columns', () => {
    // Reproduces the "no such column: last_synced_at" state: tables exist,
    // Migrations says v2 was applied, but IndexMetadata is missing columns.
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE Files (id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL);
      CREATE TABLE IndexMetadata (id INTEGER PRIMARY KEY CHECK (id = 1), status TEXT NOT NULL);
      INSERT INTO IndexMetadata (id, status) VALUES (1, 'indexed');
      CREATE TABLE Migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, checksum TEXT);
      INSERT INTO Migrations VALUES (1, 'baseline_phase7', 0, NULL), (2, 'add_sync_metadata_columns', 0, NULL);
      INSERT INTO Files (path) VALUES ('C:\\old.txt');
    `);
    legacy.close();

    const db = getDatabase();
    const report = getLastOpenReport();
    expect(report?.action).toBe('reset');
    expect(report?.reason).toMatch(/legacy/);
    expect(validateSchema(db).compatible).toBe(true);
    expect(count('Files')).toBe(0);
    expect(getIndexMetadata().last_synced_at).toBeNull();
    expect(new IntegrityManager().verify().healthy).toBe(true);
  });

  it('rebuilds a database whose version is current but whose shape is not', () => {
    const broken = new Database(dbPath);
    broken.exec(`
      CREATE TABLE IndexMetadata (id INTEGER PRIMARY KEY CHECK (id = 1), status TEXT NOT NULL);
      CREATE TABLE Migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, checksum TEXT);
    `);
    broken.pragma(`user_version = ${SCHEMA_VERSION}`);
    broken.close();

    const db = getDatabase();
    expect(getLastOpenReport()?.action).toBe('reset');
    expect(getLastOpenReport()?.reason).toMatch(/missing/);
    expect(validateSchema(db).compatible).toBe(true);
  });

  it('rebuilds a database from a newer, unknown schema version', () => {
    const newer = new Database(dbPath);
    newer.exec('CREATE TABLE Something (id INTEGER)');
    newer.pragma(`user_version = ${SCHEMA_VERSION + 5}`);
    newer.close();

    getDatabase();
    expect(getLastOpenReport()?.action).toBe('reset');
    expect(getLastOpenReport()?.reason).toMatch(/newer/);
  });

  it('resetDatabase() leaves a usable, empty database', () => {
    getDatabase();
    addFolder(dir);
    getDatabase().prepare(
      "INSERT INTO IndexLock (id, owner, acquired_at, expires_at) VALUES (1, 'x', 0, 9999999999999)"
    ).run();

    const report = resetDatabase();
    expect(report.action).toBe('reset');
    expect(getFolders()).toHaveLength(0);
    expect(count('IndexLock')).toBe(0);
    expect(count('IndexMetadata')).toBe(1);
    expect(new IntegrityManager().verify().healthy).toBe(true);
  });
});
