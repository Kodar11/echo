import { getDatabase } from './connection.js';

/**
 * - in_progress: the run has not been finalized (or the app crashed during it).
 * - completed: all intended work succeeded.
 * - completed_with_errors: the run finished but some files failed.
 * - failed: the session itself failed (e.g. database error).
 * - cancelled: the user cancelled it.
 */
export type IndexingRunStatus =
  | 'in_progress'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type RunOutcome = Exclude<IndexingRunStatus, 'in_progress'>;

export type IndexingRunKind = 'full' | 'incremental';

export interface RunCounts {
  discovered: number;
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
  skipped: number;
  failed: number;
  ignored: number;
  /** Files whose content was (re)written to the index. */
  indexed: number;
}

export function emptyRunCounts(): RunCounts {
  return {
    discovered: 0,
    added: 0,
    modified: 0,
    deleted: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    ignored: 0,
    indexed: 0,
  };
}

export interface IndexingRunRecord {
  id: number;
  trigger: string;
  kind: IndexingRunKind;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  status: IndexingRunStatus;
  files_discovered: number;
  files_added: number;
  files_modified: number;
  files_deleted: number;
  files_unchanged: number;
  files_skipped: number;
  files_failed: number;
  files_ignored: number;
  files_indexed: number;
  error_message: string | null;
}

export function startIndexingRun(
  trigger = 'manual',
  kind: IndexingRunKind = 'full',
  startedAt = Date.now()
): number {
  const result = getDatabase()
    .prepare(
      "INSERT INTO IndexingRuns (trigger, kind, started_at, status) VALUES (?, ?, ?, 'in_progress')"
    )
    .run(trigger, kind, startedAt);
  return Number(result.lastInsertRowid);
}

export function finishIndexingRun(
  runId: number,
  outcome: RunOutcome,
  durationMs: number,
  counts: RunCounts,
  errorMessage: string | null = null
): void {
  getDatabase()
    .prepare(
      `UPDATE IndexingRuns SET
         completed_at = ?, duration_ms = ?, status = ?,
         files_discovered = ?, files_added = ?, files_modified = ?, files_deleted = ?,
         files_unchanged = ?, files_skipped = ?, files_failed = ?, files_ignored = ?,
         files_indexed = ?, error_message = ?
       WHERE id = ?`
    )
    .run(
      Date.now(),
      durationMs,
      outcome,
      counts.discovered,
      counts.added,
      counts.modified,
      counts.deleted,
      counts.unchanged,
      counts.skipped,
      counts.failed,
      counts.ignored,
      counts.indexed,
      errorMessage,
      runId
    );
}

/** Marks a run that was left in_progress by a crash. */
export function markRunInterrupted(runId: number, errorMessage: string): void {
  getDatabase()
    .prepare(
      `UPDATE IndexingRuns
       SET completed_at = ?, status = 'failed', error_message = ?
       WHERE id = ? AND status = 'in_progress'`
    )
    .run(Date.now(), errorMessage, runId);
}

export function getInProgressRuns(): IndexingRunRecord[] {
  return getDatabase()
    .prepare(
      "SELECT * FROM IndexingRuns WHERE status = 'in_progress' ORDER BY started_at DESC"
    )
    .all() as IndexingRunRecord[];
}

export function getIndexingRun(runId: number): IndexingRunRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM IndexingRuns WHERE id = ?')
    .get(runId) as IndexingRunRecord | undefined;
}

export function getRecentIndexingRuns(limit = 20): IndexingRunRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM IndexingRuns ORDER BY started_at DESC, id DESC LIMIT ?')
    .all(limit) as IndexingRunRecord[];
}

/** Average duration of the most recent successful full syncs. */
export function getAverageFullRunDuration(limit = 20): number | null {
  const row = getDatabase()
    .prepare(
      `SELECT AVG(duration_ms) AS avg FROM (
         SELECT duration_ms FROM IndexingRuns
         WHERE kind = 'full'
           AND status IN ('completed', 'completed_with_errors')
           AND duration_ms IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT ?
       )`
    )
    .get(limit) as { avg: number | null };
  return row.avg === null ? null : Math.round(row.avg);
}
