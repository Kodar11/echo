import { formatCount } from './format.js';

export type StatusTone = 'idle' | 'busy' | 'ok' | 'warning' | 'error';

export interface LibraryStatus {
  tone: StatusTone;
  /** Short label for the title bar ("Up to date", "Indexing 2,481 files"). */
  label: string;
  /** Headline for the detail popover. */
  title: string;
  /** Supporting sentence for the detail popover. */
  detail: string;
  running: boolean;
  /** Determinate progress in [0, 1], or null while it cannot be known yet. */
  fraction: number | null;
}

interface StatusInput {
  progress: IndexingProgress;
  status: IndexState;
  folderCount: number;
  /** Files that failed to index and haven't been ignored. */
  attention: number;
}

/**
 * Translates backend indexing state into the language Echo shows people.
 * Raw phase/state names never reach the UI.
 */
export function describeLibraryStatus({ progress, status, folderCount, attention }: StatusInput): LibraryStatus {
  const running = progress.status === 'running';

  if (running) {
    const total = progress.total;
    const processed = Math.min(progress.processed, total);
    const fraction = total > 0 ? processed / total : null;
    switch (progress.phase) {
      case 'cancelling':
        return {
          tone: 'busy',
          label: 'Cancelling…',
          title: 'Cancelling',
          detail: 'Finishing the current file and saving what was indexed.',
          running,
          fraction,
        };
      case 'finalizing':
        return {
          tone: 'busy',
          label: 'Finishing up…',
          title: 'Finishing up',
          detail: 'Saving the index.',
          running,
          fraction: 1,
        };
      case 'indexing':
        return {
          tone: 'busy',
          label: fraction !== null ? `Indexing · ${Math.floor(fraction * 100)}%` : 'Indexing…',
          title: 'Indexing your library',
          // The search index is refreshed when a run finishes, not per file.
          detail:
            status.indexedFiles > 0
              ? 'You can keep searching; new and changed files appear when this finishes.'
              : 'Your files become searchable when this finishes.',
          running,
          fraction,
        };
      default:
        // starting / crawling / syncing
        return {
          tone: 'busy',
          label: 'Scanning…',
          title: 'Looking for changes',
          detail: 'Checking your folders for new, changed and removed files.',
          running,
          fraction: null,
        };
    }
  }

  if (folderCount === 0) {
    return {
      tone: 'idle',
      label: 'No folders',
      title: 'Nothing to search yet',
      detail: 'Add a folder to your library and Echo will index it.',
      running,
      fraction: null,
    };
  }

  switch (status.lastRunStatus) {
    case 'completed_with_errors': {
      const failed = status.lastRunFailed;
      return {
        tone: 'warning',
        label: failed > 0 ? needAttention(failed) : 'Needs attention',
        title: 'Completed with errors',
        detail:
          failed > 0
            ? `${formatCount(failed)} ${failed === 1 ? 'file' : 'files'} could not be indexed. Everything else is searchable.`
            : 'Some files could not be indexed. Everything else is searchable.',
        running,
        fraction: null,
      };
    }
    case 'failed':
      return {
        tone: 'error',
        label: 'Indexing stopped',
        title: 'Indexing didn’t finish',
        detail: 'Something went wrong while updating the index. Try syncing again.',
        running,
        fraction: null,
      };
    case 'cancelled':
      return {
        tone: 'idle',
        label: 'Paused',
        title: 'Indexing was cancelled',
        detail: 'Files indexed so far are searchable. Sync to pick up the rest.',
        running,
        fraction: null,
      };
    default:
      if (attention > 0) {
        return {
          tone: 'warning',
          label: needAttention(attention),
          title: 'Up to date, with exceptions',
          detail: `${formatCount(attention)} ${attention === 1 ? 'file' : 'files'} couldn’t be indexed. Everything else is searchable.`,
          running,
          fraction: null,
        };
      }
      if (status.status === 'never_indexed') {
        return {
          tone: 'idle',
          label: 'Not indexed',
          title: 'Not indexed yet',
          detail: 'Sync your library to make its files searchable.',
          running,
          fraction: null,
        };
      }
      return {
        tone: 'ok',
        label: 'Up to date',
        title: 'Up to date',
        detail: 'Echo is watching your library for changes.',
        running,
        fraction: null,
      };
  }
}

const needAttention = (count: number) => `${formatCount(count)} ${count === 1 ? 'needs' : 'need'} attention`;

/** Human-readable names for indexing failure categories. */
export const FAILURE_CATEGORY_LABELS: Record<string, string> = {
  corrupted: 'The file appears to be damaged',
  encrypted: 'The file is password-protected',
  permission_denied: 'Echo doesn’t have permission to read it',
  locked: 'The file is in use by another app',
  not_found: 'The file was moved or deleted',
  read_error: 'The file could not be read',
  extraction_failed: 'Text couldn’t be extracted from it',
  database_error: 'The index couldn’t be updated for it',
  crawl_error: 'The folder couldn’t be scanned',
};

export function describeFailure(category: string): string {
  return FAILURE_CATEGORY_LABELS[category] ?? 'The file could not be read';
}
