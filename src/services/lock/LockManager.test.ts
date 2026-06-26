import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LockManager } from './LockManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';

describe('LockManager', () => {
  let dbInfo: { dbPath: string };
  let manager: LockManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new LockManager(getDatabase(), 60_000);
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('acquires and releases a lock', () => {
    expect(manager.acquire('owner-a')).toBe(true);
    expect(manager.isLocked()).toBe(true);
    expect(manager.getLock()?.owner).toBe('owner-a');

    expect(manager.release('owner-a')).toBe(true);
    expect(manager.isLocked()).toBe(false);
  });

  it('prevents a second owner from acquiring the lock', () => {
    manager.acquire('owner-a');
    expect(manager.acquire('owner-b')).toBe(false);
  });

  it('does not allow the wrong owner to release the lock', () => {
    manager.acquire('owner-a');
    expect(manager.release('owner-b')).toBe(false);
    expect(manager.isLocked()).toBe(true);
  });

  it('recovers stale locks', () => {
    const staleManager = new LockManager(getDatabase(), -1);
    staleManager.acquire('stale-owner');

    expect(manager.acquire('new-owner')).toBe(true);
    expect(manager.getLock()?.owner).toBe('new-owner');
  });

  it('renews the lock expiration', () => {
    manager.acquire('owner-a');
    const before = manager.getLock()!.expires_at;
    manager.renew('owner-a');
    const after = manager.getLock()!.expires_at;
    expect(after).toBeGreaterThan(before);
  });
});
