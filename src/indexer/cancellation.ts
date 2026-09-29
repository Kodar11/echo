/**
 * Cancellation helpers built on the standard AbortSignal.
 *
 * Indexing work checks the session's signal at every async boundary and once
 * more synchronously at the start of each write transaction. Because
 * better-sqlite3 transactions are synchronous, nothing can abort between that
 * final check and the commit, so no write is committed after cancellation was
 * observed. Extractors that cannot be interrupted (e.g. PDF parsing) are
 * allowed to finish; their result is discarded.
 */
export class CancelledError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CancelledError();
  }
}

export function isCancellation(err: unknown): boolean {
  return (
    err instanceof CancelledError ||
    (err instanceof Error && err.name === 'AbortError')
  );
}
