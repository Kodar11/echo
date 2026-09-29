import type Database from 'better-sqlite3';
import { getDatabase } from '../../database/connection.js';
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

/**
 * Persistent index lock. It guards the index against concurrent writers across
 * processes and lets startup detect a session that died without cleanup. The
 * owner must renew it periodically while a session runs; an expired lock is
 * considered stale and can be taken over.
 */
export const DEFAULT_LOCK_TTL_MS = 2 * 60 * 1000;

export class LockManager {
  constructor(
    private readonly explicitDatabase?: Database.Database,
    private readonly lockTtlMs = DEFAULT_LOCK_TTL_MS
  ) {}

  private get database(): Database.Database {
    return this.explicitDatabase ?? getDatabase();
  }

  getTtlMs(): number {
    return this.lockTtlMs;
  }

  acquire(owner: string, context: LockContext = {}): boolean {
    const db = this.database;
    const now = Date.now();
    // Take-over of a stale lock and insertion happen atomically.
    const acquired = db.transaction(() => {
      db.prepare('DELETE FROM IndexLock WHERE expires_at <= ?').run(now);
      const result = db
        .prepare(
          'INSERT OR IGNORE INTO IndexLock (id, owner, acquired_at, expires_at, context) VALUES (1, ?, ?, ?, ?)'
        )
        .run(owner, now, now + this.lockTtlMs, JSON.stringify(context));
      return result.changes === 1;
    })();

    if (acquired) {
      getLogger().info('index', 'LockManager', `Lock acquired by ${owner}`);
    } else {
      getLogger().warn(
        'index',
        'LockManager',
        `Cannot acquire lock for ${owner}: held by ${this.getLock()?.owner ?? 'unknown'}`
      );
    }
    return acquired;
  }

  release(owner: string): boolean {
    const existing = this.getLock();
    if (!existing) return true;
    if (existing.owner !== owner) {
      getLogger().warn(
        'index',
        'LockManager',
        `Cannot release lock: ${owner} does not own it (owned by ${existing.owner})`
      );
      return false;
    }
    this.database.prepare('DELETE FROM IndexLock WHERE id = 1 AND owner = ?').run(owner);
    getLogger().info('index', 'LockManager', `Lock released by ${owner}`);
    return true;
  }

  renew(owner: string): boolean {
    const result = this.database
      .prepare('UPDATE IndexLock SET expires_at = ? WHERE id = 1 AND owner = ?')
      .run(Date.now() + this.lockTtlMs, owner);
    return result.changes === 1;
  }

  getLock(): LockRecord | null {
    const row = this.database.prepare('SELECT * FROM IndexLock WHERE id = 1').get() as
      | LockRecord
      | undefined;
    return row ?? null;
  }

  isLocked(): boolean {
    const lock = this.getLock();
    return lock !== null && lock.expires_at > Date.now();
  }

  recoverStaleLocks(): number {
    const count = this.database
      .prepare('DELETE FROM IndexLock WHERE expires_at <= ?')
      .run(Date.now()).changes;
    if (count > 0) {
      getLogger().warn('index', 'LockManager', `Recovered ${count} stale lock(s)`);
    }
    return count;
  }

  forceRelease(): boolean {
    const released = this.database.prepare('DELETE FROM IndexLock WHERE id = 1').run().changes > 0;
    if (released) {
      getLogger().warn('index', 'LockManager', 'Lock forcefully released');
    }
    return released;
  }
}
