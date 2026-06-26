import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MaintenanceManager } from './MaintenanceManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';

describe('MaintenanceManager', () => {
  let dbInfo: { dbPath: string };
  let manager: MaintenanceManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new MaintenanceManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('runs maintenance without vacuum', () => {
    const result = manager.runMaintenance();
    expect(result.success).toBe(true);
    const names = result.operations.map((o) => o.name);
    expect(names).toContain('integrity_check');
    expect(names).toContain('optimize');
    expect(names).toContain('analyze');
    expect(names).toContain('wal_checkpoint');
    expect(names).not.toContain('vacuum');
  });

  it('runs maintenance with vacuum when requested', () => {
    const result = manager.runMaintenance({ vacuum: true });
    expect(result.success).toBe(true);
    const names = result.operations.map((o) => o.name);
    expect(names).toContain('vacuum');
  });

  it('reports integrity_check details', () => {
    const result = manager.runMaintenance();
    const integrityOp = result.operations.find(
      (o) => o.name === 'integrity_check'
    );
    expect(integrityOp?.success).toBe(true);
    expect(integrityOp?.message).toBe('ok');
  });
});
