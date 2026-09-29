import { getDatabase } from './connection.js';
import {
  getAverageFullRunDuration,
  type IndexingRunKind,
  type RunOutcome,
} from './indexingRuns.js';
import { SCHEMA_VERSION } from './schema.js';

/**
 * Coarse, persisted availability of the index:
 * - never_indexed: no indexing run has completed yet.
 * - indexing: a session is active (left behind only if the app crashed).
 * - indexed: at least one run completed; the index is usable.
 * - error: the most recent session failed as a whole.
 *
 * Per-file failures do not make the index 'error'; they are reported through
 * last_run_status = 'completed_with_errors' and the IndexingFailures table.
 */
export type IndexStatus = 'never_indexed' | 'indexing' | 'indexed' | 'error';

export interface IndexMetadataRecord {
  id: number;
  status: IndexStatus;
  last_run_id: number | null;
  last_run_status: RunOutcome | null;
  last_indexed_at: number | null;
  last_synced_at: number | null;
  last_index_duration_ms: number | null;
  average_index_duration_ms: number | null;
  total_indexing_runs: number;
  total_indexed_files: number;
  total_indexed_terms: number;
  ignored_files_count: number;
  unsupported_files_count: number;
  oversized_files_count: number;
  inaccessible_files_count: number;
  schema_version: number;
  index_version: number;
  app_version: string | null;
  created_at: number | null;
  last_migration_at: number | null;
  error_message: string | null;
}

export interface CrawlCounts {
  ignored: number;
  unsupported: number;
  oversized: number;
  inaccessible: number;
}

export interface SessionFinalization {
  runId: number;
  kind: IndexingRunKind;
  outcome: RunOutcome;
  durationMs: number;
  errorMessage?: string | null;
  /** Only provided for full syncs whose crawl finished. */
  crawlCounts?: CrawlCounts;
  /** When the finished full sync started; becomes last_synced_at. */
  syncedAt?: number;
}

function ensureRow(): void {
  getDatabase()
    .prepare(
      `INSERT OR IGNORE INTO IndexMetadata (id, status, schema_version, created_at)
       VALUES (1, 'never_indexed', ?, ?)`
    )
    .run(SCHEMA_VERSION, Date.now());
}

export function getIndexMetadata(): IndexMetadataRecord {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM IndexMetadata WHERE id = 1')
    .get() as IndexMetadataRecord | undefined;
  if (row) return row;
  ensureRow();
  return db.prepare('SELECT * FROM IndexMetadata WHERE id = 1').get() as IndexMetadataRecord;
}

export function setIndexingStatus(status: IndexStatus, errorMessage?: string): void {
  ensureRow();
  getDatabase()
    .prepare('UPDATE IndexMetadata SET status = ?, error_message = ? WHERE id = 1')
    .run(status, errorMessage ?? null);
}

/** The status to show when no session is running, derived from real state. */
export function computeRestingStatus(): IndexStatus {
  const db = getDatabase();
  const meta = getIndexMetadata();
  if (meta.last_run_status === 'failed') return 'error';
  if (meta.last_indexed_at !== null) return 'indexed';
  const files = db.prepare('SELECT COUNT(*) AS count FROM Files').get() as { count: number };
  return files.count > 0 ? 'indexed' : 'never_indexed';
}

/**
 * Writes the outcome of an indexing session. Success-only fields
 * (last_indexed_at, last_synced_at, durations, run totals, crawl counts) are
 * only updated when the run actually completed. File/term totals are always
 * reconciled from the tables, since work committed before a cancellation or
 * failure is real.
 */
export function recordSessionFinished(result: SessionFinalization): void {
  const db = getDatabase();
  ensureRow();

  db.transaction(() => {
    const now = Date.now();
    const succeeded =
      result.outcome === 'completed' || result.outcome === 'completed_with_errors';

    const files = db.prepare('SELECT COUNT(*) AS count FROM Files').get() as { count: number };
    const terms = db.prepare('SELECT COUNT(*) AS count FROM Terms').get() as { count: number };

    db.prepare(
      `UPDATE IndexMetadata SET
         last_run_id = ?, last_run_status = ?, error_message = ?,
         total_indexed_files = ?, total_indexed_terms = ?
       WHERE id = 1`
    ).run(
      result.runId,
      result.outcome,
      result.outcome === 'failed' ? result.errorMessage ?? 'Indexing failed' : null,
      files.count,
      terms.count
    );

    if (succeeded) {
      db.prepare('UPDATE IndexMetadata SET last_indexed_at = ? WHERE id = 1').run(now);
    }

    if (succeeded && result.kind === 'full') {
      db.prepare(
        `UPDATE IndexMetadata SET
           last_synced_at = ?, last_index_duration_ms = ?, average_index_duration_ms = ?,
           total_indexing_runs = total_indexing_runs + 1
         WHERE id = 1`
      ).run(result.syncedAt ?? now, result.durationMs, getAverageFullRunDuration());

      if (result.crawlCounts) {
        db.prepare(
          `UPDATE IndexMetadata SET
             ignored_files_count = ?, unsupported_files_count = ?,
             oversized_files_count = ?, inaccessible_files_count = ?
           WHERE id = 1`
        ).run(
          result.crawlCounts.ignored,
          result.crawlCounts.unsupported,
          result.crawlCounts.oversized,
          result.crawlCounts.inaccessible
        );
      }
    }

    db.prepare('UPDATE IndexMetadata SET status = ? WHERE id = 1').run(computeRestingStatus());
  })();
}

/** Resets index-derived metadata after the index data was cleared. */
export function resetIndexMetadata(): void {
  ensureRow();
  getDatabase()
    .prepare(
      `UPDATE IndexMetadata
       SET status = 'never_indexed',
           last_run_id = NULL,
           last_run_status = NULL,
           last_indexed_at = NULL,
           last_synced_at = NULL,
           last_index_duration_ms = NULL,
           average_index_duration_ms = NULL,
           total_indexing_runs = 0,
           total_indexed_files = 0,
           total_indexed_terms = 0,
           ignored_files_count = 0,
           unsupported_files_count = 0,
           oversized_files_count = 0,
           inaccessible_files_count = 0,
           error_message = NULL
       WHERE id = 1`
    )
    .run();
}

export function setIgnoredFilesCount(count: number): void {
  ensureRow();
  getDatabase()
    .prepare('UPDATE IndexMetadata SET ignored_files_count = ? WHERE id = 1')
    .run(count);
}

export function getIgnoredFilesCount(): number {
  return getIndexMetadata().ignored_files_count;
}

export function getSchemaVersion(): number {
  return getIndexMetadata().schema_version;
}

export function setAppVersion(version: string): void {
  ensureRow();
  getDatabase().prepare('UPDATE IndexMetadata SET app_version = ? WHERE id = 1').run(version);
}
