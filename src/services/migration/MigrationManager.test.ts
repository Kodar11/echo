import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationManager, type Migration } from './MigrationManager.js';
import { setupTestDatabase, teardownTestDatabase } from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';
import { SCHEMA_VERSION } from '../../database/schema.js';

function columns(table: string): string[] {
  return (getDatabase().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name
  );
}

describe('MigrationManager', () => {
  let dbInfo: { dbPath: string };

  beforeEach(() => {
    dbInfo = setupTestDatabase();
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('a fresh database is already at the current schema version', () => {
    const manager = new MigrationManager(getDatabase());
    expect(manager.getCurrentVersion()).toBe(SCHEMA_VERSION);
    const result = manager.migrate();
    expect(result).toMatchObject({ success: true, applied: [] });
  });

  it('applies pending migrations in order and records each one', () => {
    const order: number[] = [];
    const migrations: Migration[] = [
      {
        version: SCHEMA_VERSION + 2,
        name: 'second',
        up: (db) => {
          order.push(2);
          db.exec('ALTER TABLE Settings ADD COLUMN b TEXT');
        },
      },
      {
        version: SCHEMA_VERSION + 1,
        name: 'first',
        up: (db) => {
          order.push(1);
          db.exec('ALTER TABLE Settings ADD COLUMN a TEXT');
        },
      },
    ];
    const manager = new MigrationManager(getDatabase(), migrations, SCHEMA_VERSION + 2);
    const result = manager.migrate();

    expect(result.success).toBe(true);
    expect(order).toEqual([1, 2]);
    expect(result.applied).toEqual([SCHEMA_VERSION + 1, SCHEMA_VERSION + 2]);
    expect(manager.getCurrentVersion()).toBe(SCHEMA_VERSION + 2);
    expect(columns('Settings')).toEqual(expect.arrayContaining(['a', 'b']));

    const recorded = getDatabase()
      .prepare('SELECT version FROM Migrations ORDER BY version')
      .all() as { version: number }[];
    expect(recorded.map((r) => r.version)).toEqual([
      SCHEMA_VERSION,
      SCHEMA_VERSION + 1,
      SCHEMA_VERSION + 2,
    ]);
  });

  it('never records a migration that failed, and rolls back its partial changes', () => {
    const migrations: Migration[] = [
      {
        version: SCHEMA_VERSION + 1,
        name: 'broken',
        up: (db) => {
          db.exec('ALTER TABLE Settings ADD COLUMN half_done TEXT');
          throw new Error('boom');
        },
      },
    ];
    const manager = new MigrationManager(getDatabase(), migrations, SCHEMA_VERSION + 1);
    const result = manager.migrate();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/boom/);
    expect(manager.getCurrentVersion()).toBe(SCHEMA_VERSION);
    expect(columns('Settings')).not.toContain('half_done');
    const recorded = getDatabase().prepare('SELECT MAX(version) AS v FROM Migrations').get() as {
      v: number;
    };
    expect(recorded.v).toBe(SCHEMA_VERSION);
  });

  it('refuses to skip a missing intermediate migration', () => {
    const migrations: Migration[] = [
      { version: SCHEMA_VERSION + 2, name: 'gap', up: () => undefined },
    ];
    const result = new MigrationManager(getDatabase(), migrations, SCHEMA_VERSION + 2).migrate();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing migration/);
  });

  it('does not re-apply migrations', () => {
    const migrations: Migration[] = [
      { version: SCHEMA_VERSION + 1, name: 'once', up: (db) => db.exec('CREATE TABLE Once (id INTEGER)') },
    ];
    const manager = new MigrationManager(getDatabase(), migrations, SCHEMA_VERSION + 1);
    expect(manager.migrate().applied).toEqual([SCHEMA_VERSION + 1]);
    expect(manager.migrate().applied).toEqual([]);
  });
});
