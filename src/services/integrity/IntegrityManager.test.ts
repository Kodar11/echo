import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrityManager } from './IntegrityManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';
import { insertFile } from '../../database/files.js';
import { getOrCreateTerm } from '../../database/terms.js';
import { insertPosting } from '../../database/postings.js';
import { getIndexMetadata } from '../../database/indexMetadata.js';

describe('IntegrityManager', () => {
  let dbInfo: { dbPath: string };
  let manager: IntegrityManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new IntegrityManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('reports healthy for an empty consistent database', () => {
    const report = manager.verify();
    expect(report.healthy).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('detects orphan terms', () => {
    getOrCreateTerm('orphan');
    const report = manager.verify();
    expect(report.healthy).toBe(false);
    expect(report.issues.some((i) => i.type === 'orphan_term')).toBe(true);
  });

  it('detects partial files without postings', () => {
    const now = Date.now();
    insertFile('/tmp/partial.txt', 100, now, 0, now);
    const report = manager.verify();
    expect(report.issues.some((i) => i.type === 'missing_file')).toBe(true);
  });

  it('detects invalid metadata counters', () => {
    getIndexMetadata(); // ensure row exists
    getDatabase()
      .prepare('UPDATE IndexMetadata SET total_indexed_files = 99 WHERE id = 1')
      .run();

    const report = manager.verify();
    expect(report.issues.some((i) => i.type === 'invalid_metadata')).toBe(true);
  });

  it('repairs orphan terms', () => {
    getOrCreateTerm('orphan');
    const repairReport = manager.verifyAndRepair();
    expect(repairReport.repaired).toBe(true);

    const verifyReport = manager.verify();
    expect(verifyReport.healthy).toBe(true);
  });

  it('passes pragma integrity check', () => {
    const result = manager.runPragmaIntegrityCheck();
    expect(result.ok).toBe(true);
  });
});
