import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecoveryManager } from './RecoveryManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';
import { getIndexMetadata, setIndexingStatus } from '../../database/indexMetadata.js';
import { startIndexingRun } from '../../database/indexingRuns.js';
import { insertFile } from '../../database/files.js';

describe('RecoveryManager', () => {
  let dbInfo: { dbPath: string };
  let manager: RecoveryManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new RecoveryManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('reports no recovery needed on a fresh index', () => {
    const result = manager.checkAndRecover(false);
    expect(result.recovered).toBe(false);
    expect(result.interruptedRuns).toBe(0);
  });

  it('detects interrupted indexing session', () => {
    setIndexingStatus('indexing');
    startIndexingRun();

    const result = manager.checkAndRecover(false);
    expect(result.recovered).toBe(true);
    expect(result.interruptedRuns).toBe(1);
  });

  it('finds partial files without postings', () => {
    const now = Date.now();
    insertFile('/tmp/partial.txt', 100, now, 0, now);

    const partialFiles = manager.findPartialFiles();
    expect(partialFiles).toContain('/tmp/partial.txt');
  });

  it('reconciles metadata counters', () => {
    getIndexMetadata(); // ensure row exists
    const now = Date.now();
    insertFile('/tmp/file1.txt', 100, now, 0, now);
    insertFile('/tmp/file2.txt', 100, now, 0, now);

    manager.reconcileMetadataCounters();

    const metadata = getDatabase()
      .prepare('SELECT total_indexed_files FROM IndexMetadata WHERE id = 1')
      .get() as { total_indexed_files: number };
    expect(metadata.total_indexed_files).toBe(2);
  });
});
