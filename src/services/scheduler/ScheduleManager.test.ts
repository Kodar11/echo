import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScheduleManager } from './ScheduleManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';

describe('ScheduleManager', () => {
  let dbInfo: { dbPath: string };
  let syncCalls: Array<{ trigger: string }>;
  let manager: ScheduleManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    syncCalls = [];
    manager = new ScheduleManager({
      onStartupSync: async () => {
        syncCalls.push({ trigger: 'scheduled' });
      },
    });
  });

  afterEach(() => {
    manager.stop();
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('defaults to immediate mode', () => {
    expect(manager.getIndexingMode()).toBe('immediate');
  });

  it('enables watchers only in immediate mode', () => {
    manager.setIndexingMode('immediate');
    expect(manager.shouldEnableWatchers()).toBe(true);

    manager.setIndexingMode('startup');
    expect(manager.shouldEnableWatchers()).toBe(false);

    manager.setIndexingMode('scheduled');
    expect(manager.shouldEnableWatchers()).toBe(false);

    manager.setIndexingMode('manual');
    expect(manager.shouldEnableWatchers()).toBe(false);
  });

  it('runs startup sync for immediate and startup modes', () => {
    manager.setIndexingMode('immediate');
    expect(manager.shouldRunStartupSync()).toBe(true);

    manager.setIndexingMode('startup');
    expect(manager.shouldRunStartupSync()).toBe(true);

    manager.setIndexingMode('scheduled');
    expect(manager.shouldRunStartupSync()).toBe(false);

    manager.setIndexingMode('manual');
    expect(manager.shouldRunStartupSync()).toBe(false);
  });

  it('persists mode and interval settings', () => {
    manager.setIndexingMode('scheduled');
    manager.setScheduleInterval('hourly');

    const second = new ScheduleManager({
      onStartupSync: async () => {},
    });
    expect(second.getIndexingMode()).toBe('scheduled');
    expect(second.getScheduleInterval()).toBe('hourly');
    second.stop();
  });

  it('runs scheduled sync when started in scheduled mode', async () => {
    vi.useFakeTimers();
    manager.setIndexingMode('scheduled');
    manager.setScheduleInterval('hourly');
    manager.start();

    vi.advanceTimersByTime(6000);
    await vi.runOnlyPendingTimersAsync();

    expect(syncCalls.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });
});
