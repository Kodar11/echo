import type Database from 'better-sqlite3';
import { getLogger } from '../logger/logger.js';

export interface LockContext {
  trigger?: string;
  runId?: number;
}

export interface LockRecord {
  id: number;
  owner: string;
  acquired_at: number;
  expires_at: number;
  context: string | null;
}

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class LockManager {
  private database: Database.Database;
  private lockTtlMs: number;

  constructor(database: Database.Database, lockTtlMs = DEFAULT_LOCK_TTL_MS) {
    this.database = database;
    this.lockTtlMs = lockTtlMs;
  }

  acquire(owner: string, context: LockContext = {}): boolean {
    this.recoverStaleLocks();

    const now = Date.now();
    const expiresAt = now + this.lockTtlMs;
    const contextJson = JSON.stringify(context);

    const existing = this.getLock();
    if (existing) {
      getLogger().warn(
        'index',
        'LockManager',
        `Cannot acquire lock for ${owner}: already held by ${existing.owner}`
      );
      return false;
    }

    try {
      this.database
        .prepare(
          'INSERT OR REPLACE INTO IndexLock (id, owner, acquired_at, expires_at, context) VALUES (1, ?, ?, ?, ?)'
        )
        .run(owner, now, expiresAt, contextJson);
      getLogger().info(
        'index',
        'LockManager',
        `Lock acquired by ${owner} until ${new Date(expiresAt).toISOString()}`
      );
      return true;
    } catch (err) {
      getLogger().error(
        'index',
        'LockManager',
        `Failed to acquire lock for ${owner}: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  release(owner: string): boolean {
    const existing = this.getLock();
    if (!existing) {
      return true;
    }

    if (existing.owner !== owner) {
      getLogger().warn(
        'index',
        'LockManager',
        `Cannot release lock: ${owner} does not own it (owned by ${existing.owner})`
      );
      return false;
    }

    this.database.prepare('DELETE FROM IndexLock WHERE id = 1').run();
    getLogger().info('index', 'LockManager', `Lock released by ${owner}`);
    return true;
  }

  renew(owner: string): boolean {
    const existing = this.getLock();
    if (!existing || existing.owner !== owner) {
      return false;
    }

    const expiresAt = Date.now() + this.lockTtlMs;
    this.database
      .prepare('UPDATE IndexLock SET expires_at = ? WHERE id = 1')
      .run(expiresAt);
    getLogger().debug('index', 'LockManager', `Lock renewed by ${owner}`);
    return true;
  }

  getLock(): LockRecord | null {
    try {
      const row = this.database
        .prepare('SELECT * FROM IndexLock WHERE id = 1')
        .get() as LockRecord | undefined;
      return row ?? null;
    } catch {
      return null;
    }
  }

  isLocked(): boolean {
    const lock = this.getLock();
    if (!lock) return false;
    return lock.expires_at > Date.now();
  }

  recoverStaleLocks(): number {
    const now = Date.now();
    const result = this.database
      .prepare('DELETE FROM IndexLock WHERE expires_at <= ?')
      .run(now);
    const count = result.changes;
    if (count > 0) {
      getLogger().warn(
        'index',
        'LockManager',
        `Recovered ${count} stale lock(s)`
      );
    }
    return count;
  }

  forceRelease(): void {
    this.database.prepare('DELETE FROM IndexLock WHERE id = 1').run();
    getLogger().warn('index', 'LockManager', 'Lock forcefully released');
  }
}
