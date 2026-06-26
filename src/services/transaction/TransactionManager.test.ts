import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransactionManager } from './TransactionManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';

describe('TransactionManager', () => {
  let dbInfo: { dbPath: string };
  let manager: TransactionManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new TransactionManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('commits successful transactions', () => {
    manager.run(() => {
      getDatabase()
        .prepare("INSERT INTO Settings (key, value) VALUES (?, ?)")
        .run('test-key', 'test-value');
    }, { name: 'insert' });

    const row = getDatabase()
      .prepare('SELECT value FROM Settings WHERE key = ?')
      .get('test-key') as { value: string };
    expect(row.value).toBe('test-value');
  });

  it('rolls back failed transactions', () => {
    expect(() => {
      manager.run(() => {
        getDatabase()
          .prepare("INSERT INTO Settings (key, value) VALUES (?, ?)")
          .run('rollback-key', 'value');
        throw new Error('forced failure');
      }, { name: 'rollback' });
    }).toThrow('forced failure');

    const row = getDatabase()
      .prepare('SELECT value FROM Settings WHERE key = ?')
      .get('rollback-key') as { value: string } | undefined;
    expect(row).toBeUndefined();
  });
});
