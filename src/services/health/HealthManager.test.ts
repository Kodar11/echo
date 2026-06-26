import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HealthManager } from './HealthManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import {
  setIgnoredFilesCount,
  setIndexingStatus,
} from '../../database/indexMetadata.js';
import { recordIndexingFailure } from '../../database/indexingFailures.js';
import { insertFile } from '../../database/files.js';

describe('HealthManager', () => {
  let dbInfo: { dbPath: string };
  let manager: HealthManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new HealthManager();
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('reports healthy for a fresh empty index', () => {
    const stats = manager.getHealthStats();
    expect(stats.status).toBe('healthy');
    expect(stats.totalFiles).toBe(0);
    expect(stats.failedFiles).toBe(0);
  });

  it('reports error when index status is error', () => {
    setIndexingStatus('error', 'disk full');
    const stats = manager.getHealthStats();
    expect(stats.status).toBe('error');
  });

  it('reports warning when there are failures', () => {
    recordIndexingFailure('/tmp/file.pdf', 'corrupted', 'could not read');
    const stats = manager.getHealthStats();
    expect(stats.status).toBe('warning');
    expect(stats.failedFiles).toBe(1);
  });

  it('reports warning when there are pending jobs', () => {
    const stats = manager.getHealthStats(3);
    expect(stats.status).toBe('warning');
    expect(stats.pendingJobs).toBe(3);
  });

  it('reports ignored files count', () => {
    setIgnoredFilesCount(42);
    const stats = manager.getHealthStats();
    expect(stats.ignoredFiles).toBe(42);
  });

  it('computes error when failure ratio exceeds threshold', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      insertFile(`/tmp/ok${i}.txt`, 100, now, 10, now);
    }
    for (let i = 0; i < 5; i++) {
      recordIndexingFailure(`/tmp/bad${i}.pdf`, 'corrupted', 'could not read');
    }

    const stats = manager.getHealthStats();
    expect(stats.status).toBe('error');
  });
});
