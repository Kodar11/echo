import { getAllFileStates } from '../database/files.js';
import { getEnabledFolders, type FolderRecord } from '../database/folders.js';
import {
  deleteIndexingFailuresNotIn,
  getIndexingFailures,
  recordIndexingFailure,
  type FailureCategory,
} from '../database/indexingFailures.js';
import { emptyRunCounts, type RunCounts } from '../database/indexingRuns.js';
import { getLogger } from '../services/logger/logger.js';
import { throwIfCancelled } from './cancellation.js';
import { crawlDirectory, type CrawlError, type DiskFileState } from './crawler.js';
import type { IndexingSettings } from './indexingSettings.js';
import type { IndexQueue, IndexTask, QueueResult } from './IndexQueue.js';
import { isInsideAny } from './paths.js';

export type SyncPhase = 'crawling' | 'syncing' | 'indexing';

export interface SyncOptions {
  queue: IndexQueue;
  settings: IndexingSettings;
  signal?: AbortSignal;
  /** Re-index every file even if unchanged (indexing configuration changed). */
  force?: boolean;
  onPhase?: (phase: SyncPhase) => void;
}

export interface CrawlSummary {
  ignored: number;
  unsupported: number;
  oversized: number;
  inaccessible: number;
  symlinks: number;
}

export interface SyncReport {
  /** Folders whose disk state was fully reconciled (root was readable). */
  syncedFolderIds: number[];
  counts: RunCounts;
  crawl: CrawlSummary;
  crawlErrors: CrawlError[];
  queue: QueueResult;
}

/**
 * Failure categories that are a property of the file's bytes. A file that
 * failed with one of these is not retried until it changes on disk.
 */
const DETERMINISTIC_FAILURES = new Set<FailureCategory>([
  'extraction_failed',
  'corrupted',
  'encrypted',
]);

/**
 * One full synchronization of the enabled folders against the index:
 * crawl → detect changes → enqueue → process the queue to completion.
 *
 * It does not finalize anything (run records, metadata, lock); the caller
 * owns the session lifecycle and finalizes after this resolves or throws.
 */
export class SyncManager {
  async sync(options: SyncOptions): Promise<SyncReport> {
    const { queue, settings, signal, force = false, onPhase } = options;
    const folders = getEnabledFolders();

    onPhase?.('crawling');
    const disk = new Map<string, DiskFileState>();
    const unreadablePaths: string[] = [];
    const crawlErrors: CrawlError[] = [];
    const syncedFolders: FolderRecord[] = [];
    const crawl: CrawlSummary = {
      ignored: 0,
      unsupported: 0,
      oversized: 0,
      inaccessible: 0,
      symlinks: 0,
    };

    for (const folder of folders) {
      throwIfCancelled(signal);
      const result = await crawlDirectory(folder.path, { signal, settings });
      for (const [filePath, state] of result.files) disk.set(filePath, state);
      unreadablePaths.push(...result.unreadablePaths);
      crawlErrors.push(...result.errors);
      crawl.ignored += result.ignoredCount;
      crawl.unsupported += result.unsupportedCount;
      crawl.oversized += result.oversizedCount;
      crawl.symlinks += result.symlinkCount;
      crawl.inaccessible += result.errors.length;
      if (result.rootAccessible) syncedFolders.push(folder);
    }
    throwIfCancelled(signal);

    onPhase?.('syncing');
    for (const error of crawlErrors) {
      recordIndexingFailure(
        error.path,
        error.code === 'EACCES' || error.code === 'EPERM' ? 'permission_denied' : 'crawl_error',
        error.message
      );
    }

    const knownFailures = new Map(
      getIndexingFailures(true).map((f) => [f.path, f] as const)
    );
    const tasks: IndexTask[] = [];
    let unchanged = 0;
    let skippedKnownFailures = 0;
    let keptUnreadable = 0;

    const indexed = new Map(getAllFileStates().map((f) => [f.path, f] as const));

    for (const [filePath, state] of disk) {
      const existing = indexed.get(filePath);
      if (!existing) {
        const failure = knownFailures.get(filePath);
        if (
          !force &&
          failure &&
          DETERMINISTIC_FAILURES.has(failure.category) &&
          failure.size === state.size &&
          failure.modified_time === state.mtimeMs
        ) {
          skippedKnownFailures++;
          continue;
        }
        tasks.push({ type: 'index', path: filePath, change: 'added' });
      } else if (
        force ||
        !existing.content_hash ||
        existing.size !== state.size ||
        existing.modified_time !== state.mtimeMs
      ) {
        tasks.push({ type: 'index', path: filePath, change: 'modified' });
      } else {
        unchanged++;
      }
    }

    // Indexed files that are not indexable on disk any more: deleted, now
    // ignored/oversized/unsupported, or in a removed/disabled folder. Files
    // under a path we could not read keep their entries: their state is
    // unknown, and an unplugged drive must not wipe its part of the index.
    for (const filePath of indexed.keys()) {
      if (disk.has(filePath)) continue;
      if (isInsideAny(filePath, unreadablePaths)) {
        keptUnreadable++;
        continue;
      }
      tasks.push({ type: 'delete', path: filePath });
    }

    // Failure records for paths that no longer exist are stale.
    const stillRelevant = new Set<string>([...disk.keys(), ...crawlErrors.map((e) => e.path)]);
    deleteIndexingFailuresNotIn(stillRelevant, (p) => !isInsideAny(p, unreadablePaths));

    throwIfCancelled(signal);
    onPhase?.('indexing');

    getLogger().info(
      'index',
      'SyncManager',
      `Changes: discovered=${disk.size}, toIndex=${tasks.filter((t) => t.type === 'index').length}, ` +
        `toDelete=${tasks.filter((t) => t.type === 'delete').length}, unchanged=${unchanged}, ` +
        `knownFailures=${skippedKnownFailures}, keptUnreadable=${keptUnreadable}, force=${force}`
    );

    queue.enqueueMany(tasks);
    const queueResult = await queue.run(signal);

    const counts = emptyRunCounts();
    counts.discovered = disk.size;
    counts.added = queueResult.added;
    counts.modified = queueResult.modified;
    counts.deleted = queueResult.deleted;
    counts.indexed = queueResult.indexed;
    counts.unchanged = unchanged + queueResult.unchanged;
    counts.skipped = skippedKnownFailures + queueResult.skipped + crawl.oversized + crawl.unsupported;
    counts.failed = queueResult.failed + crawlErrors.length;
    counts.ignored = crawl.ignored;

    return {
      syncedFolderIds: syncedFolders.map((f) => f.id),
      counts,
      crawl,
      crawlErrors,
      queue: queueResult,
    };
  }
}
