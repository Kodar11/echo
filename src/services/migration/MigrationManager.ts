import type Database from 'better-sqlite3';
import { SCHEMA_VERSION } from '../../database/schema.js';
import { getUserVersion } from '../../database/schemaValidation.js';

export { getUserVersion };

/**
 * A forward-only schema migration.
 *
 * Migrations run in ascending version order. Each one runs inside a single
 * transaction together with the `PRAGMA user_version` bump and the Migrations
 * row, so a migration is either fully applied and recorded or not applied at
 * all.
 *
 * To change the schema:
 *   1. Update SCHEMA_SQL in src/database/schema.ts to the new final shape.
 *   2. Bump SCHEMA_VERSION.
 *   3. Append a migration here with `version === SCHEMA_VERSION` that
 *      transforms the previous shape into the new one.
 */
export interface Migration {
  version: number;
  name: string;
  up: (database: Database.Database) => void;
}

export interface MigrationResult {
  success: boolean;
  currentVersion: number;
  targetVersion: number;
  applied: number[];
  error?: string;
}

/**
 * Oldest schema version that can be migrated forward. Databases older than
 * this (including the pre-versioning layouts that had no `user_version`) are
 * treated as incompatible and rebuilt from scratch — they only contain a
 * derived search index.
 */
export const BASELINE_SCHEMA_VERSION = 3;

/** Migrations newer than the baseline. Empty until the schema changes. */
export const MIGRATIONS: Migration[] = [];

export function runMigrations(
  database: Database.Database,
  migrations: Migration[] = MIGRATIONS,
  targetVersion: number = SCHEMA_VERSION
): MigrationResult {
  const applied: number[] = [];
  const startVersion = getUserVersion(database);

  if (startVersion < BASELINE_SCHEMA_VERSION) {
    return {
      success: false,
      currentVersion: startVersion,
      targetVersion,
      applied,
      error: `Schema version ${startVersion} is older than the supported baseline ${BASELINE_SCHEMA_VERSION}`,
    };
  }

  const pending = migrations
    .filter((m) => m.version > startVersion && m.version <= targetVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const current = getUserVersion(database);
    if (migration.version !== current + 1) {
      return {
        success: false,
        currentVersion: current,
        targetVersion,
        applied,
        error: `Missing migration for version ${current + 1} (next available is ${migration.version})`,
      };
    }

    try {
      database.transaction(() => {
        migration.up(database);
        database
          .prepare(
            'INSERT INTO Migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, NULL)'
          )
          .run(migration.version, migration.name, Date.now());
        database
          .prepare('UPDATE IndexMetadata SET schema_version = ?, last_migration_at = ? WHERE id = 1')
          .run(migration.version, Date.now());
        database.pragma(`user_version = ${migration.version}`);
      })();
      applied.push(migration.version);
    } catch (err) {
      return {
        success: false,
        currentVersion: getUserVersion(database),
        targetVersion,
        applied,
        error: `Migration ${migration.version} (${migration.name}) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  }

  const currentVersion = getUserVersion(database);
  if (currentVersion !== targetVersion) {
    return {
      success: false,
      currentVersion,
      targetVersion,
      applied,
      error: `Schema is at version ${currentVersion} after migrations, expected ${targetVersion}`,
    };
  }

  return { success: true, currentVersion, targetVersion, applied };
}

export class MigrationManager {
  constructor(
    private database: Database.Database,
    private migrations: Migration[] = MIGRATIONS,
    private targetVersion: number = SCHEMA_VERSION
  ) {}

  getCurrentVersion(): number {
    return getUserVersion(this.database);
  }

  getTargetVersion(): number {
    return this.targetVersion;
  }

  migrate(): MigrationResult {
    return runMigrations(this.database, this.migrations, this.targetVersion);
  }
}
