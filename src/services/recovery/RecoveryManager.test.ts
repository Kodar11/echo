import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecoveryManager } from './RecoveryManager.js';
import { setupTestDatabase, teardownTestDatabase } from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';
import { getIndexMetadata, setIndexingStatus } from '../../database/indexMetadata.js';
import { getIndexingRun, startIndexingRun } from '../../database/indexingRuns.js';
import { getFileCount, insertFile } from '../../database/files.js';

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
    const result = manager.checkAndRecover();
    expect(result.recovered).toBe(false);
    expect(result.interruptedRuns).toBe(0);
  });

  it('finalizes an interrupted session: run, lock and status', () => {
    setIndexingStatus('indexing');
    const runId = startIndexingRun('manual');
    getDatabase()
      .prepare("INSERT INTO IndexLock (id, owner, acquired_at, expires_at) VALUES (1, 'dead', 0, 9999999999999)")
      .run();

    const result = manager.checkAndRecover();

    expect(result).toMatchObject({ recovered: true, interruptedRuns: 1, staleLockReleased: true });
    expect(getIndexingRun(runId)?.status).toBe('failed');
    expect(getDatabase().prepare('SELECT COUNT(*) AS c FROM IndexLock').get()).toEqual({ c: 0 });
    expect(getIndexMetadata().status).toBe('never_indexed');
  });

  it('finds files with content but no postings, not empty documents', () => {
    const now = Date.now();
    insertFile('/tmp/partial.txt', 100, now, 42, now);
    insertFile('/tmp/empty.txt', 0, now, 0, now);

    expect(manager.findPartialFiles()).toEqual(['/tmp/partial.txt']);
  });

  it('removes partial files so the next sync re-indexes them', () => {
    const now = Date.now();
    insertFile('/tmp/partial.txt', 100, now, 42, now);
    const result = manager.checkAndRecover(true);
    expect(result.partialFiles).toBe(1);
    expect(getFileCount()).toBe(0);
  });

  it('leaves partial files in place when auto-recovery is off', () => {
    const now = Date.now();
    insertFile('/tmp/partial.txt', 100, now, 42, now);
    manager.checkAndRecover(false);
    expect(getFileCount()).toBe(1);
  });

  it('reconciles metadata counters', () => {
    const now = Date.now();
    insertFile('/tmp/file1.txt', 100, now, 0, now);
    insertFile('/tmp/file2.txt', 100, now, 0, now);

    manager.reconcileMetadataCounters();

    expect(getIndexMetadata().total_indexed_files).toBe(2);
  });
});
