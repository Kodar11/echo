import { getDatabase } from './connection.js';

export interface IndexingFailureRecord {
  id: number;
  path: string;
  category: string;
  message: string;
  occurred_at: number;
  retry_count: number;
  ignored: number;
}

export function recordIndexingFailure(
  path: string,
  category: string,
  message: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(
    `INSERT INTO IndexingFailures (path, category, message, occurred_at, retry_count)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(path) DO UPDATE SET
       category = excluded.category,
       message = excluded.message,
       occurred_at = excluded.occurred_at,
       retry_count = IndexingFailures.retry_count + 1`
  );
  stmt.run(path, category, message, Date.now());
}

export function clearIndexingFailure(path: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM IndexingFailures WHERE path = ?').run(path);
}

export function getIndexingFailures(
  includeIgnored = false
): IndexingFailureRecord[] {
  const db = getDatabase();
  if (includeIgnored) {
    return db
      .prepare('SELECT * FROM IndexingFailures ORDER BY occurred_at DESC')
      .all() as IndexingFailureRecord[];
  }
  return db
    .prepare('SELECT * FROM IndexingFailures WHERE ignored = 0 ORDER BY occurred_at DESC')
    .all() as IndexingFailureRecord[];
}

export function getIndexingFailureCount(includeIgnored = false): number {
  const db = getDatabase();
  if (includeIgnored) {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM IndexingFailures')
      .get() as { count: number };
    return row.count;
  }
  const row = db
    .prepare('SELECT COUNT(*) as count FROM IndexingFailures WHERE ignored = 0')
    .get() as { count: number };
  return row.count;
}

export function setIndexingFailureIgnored(
  path: string,
  ignored: boolean
): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE IndexingFailures SET ignored = ? WHERE path = ?'
  ).run(ignored ? 1 : 0, path);
}

export function deleteIndexingFailure(path: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM IndexingFailures WHERE path = ?').run(path);
}

export function deleteAllIndexingFailures(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM IndexingFailures').run();
}
