import { getDatabase } from './connection.js';

export type IndexStatus =
  | 'never_indexed'
  | 'indexing'
  | 'indexed'
  | 'error';

export interface IndexMetadataRecord {
  id: number;
  status: IndexStatus;
  last_indexed_at: number | null;
  last_synced_at: number | null;
  last_index_duration_ms: number | null;
  average_index_duration_ms: number | null;
  total_indexing_runs: number;
  total_indexed_files: number;
  total_indexed_terms: number;
  ignored_files_count: number;
  error_message: string | null;
}

export function getIndexMetadata(): IndexMetadataRecord {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM IndexMetadata WHERE id = 1')
    .get() as IndexMetadataRecord | undefined;

  if (row) return row;

  db.prepare(
    `INSERT OR IGNORE INTO IndexMetadata (id, status) VALUES (1, 'never_indexed')`
  ).run();

  return db
    .prepare('SELECT * FROM IndexMetadata WHERE id = 1')
    .get() as IndexMetadataRecord;
}

export function setIndexingStatus(
  status: IndexStatus,
  errorMessage?: string
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT OR IGNORE INTO IndexMetadata (id, status) VALUES (1, 'never_indexed')`
  ).run();
  db.prepare(
    `UPDATE IndexMetadata
     SET status = ?, error_message = ?
     WHERE id = 1`
  ).run(status, errorMessage ?? null);
}

export function recordIndexingCompleted(
  durationMs: number,
  filesIndexed: number,
  termsIndexed: number
): void {
  const db = getDatabase();
  const metadata = getIndexMetadata();

  const totalRuns = metadata.total_indexing_runs + 1;
  const avgDuration = computeAverageDuration(durationMs);

  db.prepare(
    `UPDATE IndexMetadata
     SET status = 'indexed',
         last_indexed_at = ?,
         last_index_duration_ms = ?,
         average_index_duration_ms = ?,
         total_indexing_runs = ?,
         total_indexed_files = ?,
         total_indexed_terms = ?,
         error_message = NULL
     WHERE id = 1`
  ).run(
    Date.now(),
    durationMs,
    avgDuration,
    totalRuns,
    filesIndexed,
    termsIndexed
  );
}

export function recordSyncCompleted(): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE IndexMetadata SET last_synced_at = ? WHERE id = 1`
  ).run(Date.now());
}

export function resetIndexMetadata(): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE IndexMetadata
     SET status = 'never_indexed',
         last_indexed_at = NULL,
         last_synced_at = NULL,
         last_index_duration_ms = NULL,
         average_index_duration_ms = NULL,
         total_indexing_runs = 0,
         total_indexed_files = 0,
         total_indexed_terms = 0,
         ignored_files_count = 0,
         error_message = NULL
     WHERE id = 1`
  ).run();
}

export function setIgnoredFilesCount(count: number): void {
  const db = getDatabase();
  db.prepare(
    `INSERT OR IGNORE INTO IndexMetadata (id, status) VALUES (1, 'never_indexed')`
  ).run();
  db.prepare(
    `UPDATE IndexMetadata SET ignored_files_count = ? WHERE id = 1`
  ).run(count);
}

export function getIgnoredFilesCount(): number {
  return getIndexMetadata().ignored_files_count;
}

function computeAverageDuration(durationMs: number): number {
  const db = getDatabase();
  const recentRuns = db
    .prepare(
      `SELECT duration_ms FROM IndexingRuns
       WHERE status = 'completed' AND duration_ms IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 19`
    )
    .all() as { duration_ms: number }[];

  const durations = [...recentRuns.map((r) => r.duration_ms), durationMs];
  const sum = durations.reduce((a, b) => a + b, 0);
  return Math.round(sum / durations.length);
}
