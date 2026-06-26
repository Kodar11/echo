import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationManager } from './MigrationManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';

describe('MigrationManager', () => {
  let dbInfo: { dbPath: string };
  let manager: MigrationManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new MigrationManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('starts at version 0 for a fresh test database', () => {
    expect(manager.getCurrentVersion()).toBe(0);
  });

  it('applies baseline migration successfully', () => {
    const result = manager.migrate();
    expect(result.success).toBe(true);
    expect(result.applied).toContain(1);
    expect(manager.getCurrentVersion()).toBe(1);
  });

  it('does not re-apply migrations', () => {
    manager.migrate();
    const result = manager.migrate();
    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
  });

  it('records migration in Migrations table', () => {
    manager.migrate();
    const rows = getDatabase()
      .prepare('SELECT * FROM Migrations')
      .all() as { version: number; name: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0].version).toBe(1);
  });
});
