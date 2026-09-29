import { getDatabase } from './connection.js';

/**
 * Why a file (or directory) could not be indexed. Files skipped by design
 * (ignore rules, unsupported extensions, size limit) are *not* failures; they
 * are counted per run and in IndexMetadata instead.
 */
export type FailureCategory =
  | 'permission_denied'
  | 'not_found'
  | 'read_error'
  | 'extraction_failed'
  | 'encrypted'
  | 'corrupted'
  | 'locked'
  | 'database_error'
  | 'crawl_error';

export interface IndexingFailureRecord {
  id: number;
  path: string;
  category: FailureCategory;
  message: string;
  occurred_at: number;
  retry_count: number;
  ignored: number;
  /** File size / mtime at the time of the failed attempt, when known. */
  size: number | null;
  modified_time: number | null;
}

export interface FailureFileState {
  size: number;
  modifiedTime: number;
}

export function recordIndexingFailure(
  path: string,
  category: FailureCategory,
  message: string,
  fileState?: FailureFileState
): void {
  getDatabase()
    .prepare(
      `INSERT INTO IndexingFailures (path, category, message, occurred_at, retry_count, size, modified_time)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         category = excluded.category,
         message = excluded.message,
         occurred_at = excluded.occurred_at,
         size = excluded.size,
         modified_time = excluded.modified_time,
         retry_count = IndexingFailures.retry_count + 1`
    )
    .run(
      path,
      category,
      message.slice(0, 2000),
      Date.now(),
      fileState?.size ?? null,
      fileState ? Math.trunc(fileState.modifiedTime) : null
    );
}

export function clearIndexingFailure(path: string): void {
  getDatabase().prepare('DELETE FROM IndexingFailures WHERE path = ?').run(path);
}

export function getIndexingFailures(includeIgnored = false): IndexingFailureRecord[] {
  const sql = includeIgnored
    ? 'SELECT * FROM IndexingFailures ORDER BY occurred_at DESC'
    : 'SELECT * FROM IndexingFailures WHERE ignored = 0 ORDER BY occurred_at DESC';
  return getDatabase().prepare(sql).all() as IndexingFailureRecord[];
}

export function getIndexingFailure(path: string): IndexingFailureRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM IndexingFailures WHERE path = ?')
    .get(path) as IndexingFailureRecord | undefined;
}

export function getIndexingFailureCount(includeIgnored = false): number {
  const sql = includeIgnored
    ? 'SELECT COUNT(*) as count FROM IndexingFailures'
    : 'SELECT COUNT(*) as count FROM IndexingFailures WHERE ignored = 0';
  const row = getDatabase().prepare(sql).get() as { count: number };
  return row.count;
}

export function setIndexingFailureIgnored(path: string, ignored: boolean): void {
  getDatabase()
    .prepare('UPDATE IndexingFailures SET ignored = ? WHERE path = ?')
    .run(ignored ? 1 : 0, path);
}

export function deleteIndexingFailure(path: string): void {
  clearIndexingFailure(path);
}

export function deleteAllIndexingFailures(): void {
  getDatabase().prepare('DELETE FROM IndexingFailures').run();
}

/** Removes failure records for paths no longer present on disk. */
export function deleteIndexingFailuresNotIn(keep: Set<string>, scope: (path: string) => boolean): number {
  const db = getDatabase();
  const rows = db.prepare('SELECT path FROM IndexingFailures').all() as { path: string }[];
  const stale = rows.map((r) => r.path).filter((p) => scope(p) && !keep.has(p));
  if (stale.length === 0) return 0;
  const stmt = db.prepare('DELETE FROM IndexingFailures WHERE path = ?');
  db.transaction(() => {
    for (const p of stale) stmt.run(p);
  })();
  return stale.length;
}
