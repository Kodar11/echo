import { getDatabase } from './connection.js';

export type IndexingRunStatus = 'in_progress' | 'completed' | 'failed';

export interface IndexingRunRecord {
  id: number;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  files_indexed: number;
  status: IndexingRunStatus;
  error_message: string | null;
}

export function startIndexingRun(): number {
  const db = getDatabase();
  const result = db
    .prepare(
      "INSERT INTO IndexingRuns (started_at, status) VALUES (?, 'in_progress')"
    )
    .run(Date.now());
  return Number(result.lastInsertRowid);
}

export function completeIndexingRun(
  runId: number,
  durationMs: number,
  filesIndexed: number
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE IndexingRuns
     SET completed_at = ?, duration_ms = ?, files_indexed = ?, status = 'completed'
     WHERE id = ?`
  ).run(Date.now(), durationMs, filesIndexed, runId);
}

export function failIndexingRun(
  runId: number,
  durationMs: number,
  errorMessage: string
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE IndexingRuns
     SET completed_at = ?, duration_ms = ?, status = 'failed', error_message = ?
     WHERE id = ?`
  ).run(Date.now(), durationMs, errorMessage, runId);
}

export function markRunFailed(
  runId: number,
  errorMessage: string
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE IndexingRuns
     SET completed_at = ?, duration_ms = COALESCE(duration_ms, 0), status = 'failed', error_message = ?
     WHERE id = ?`
  ).run(Date.now(), errorMessage, runId);
}

export function getInProgressRuns(): IndexingRunRecord[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM IndexingRuns WHERE status = 'in_progress' ORDER BY started_at DESC")
    .all() as IndexingRunRecord[];
}

export function getRecentIndexingRuns(limit = 20): IndexingRunRecord[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT * FROM IndexingRuns
       ORDER BY started_at DESC
       LIMIT ?`
    )
    .all(limit) as IndexingRunRecord[];
}
