import { getFileCount } from '../database/files.js';
import { getEnabledFolders, markFoldersSynced } from '../database/folders.js';
import { recordSessionFinished, setIndexingStatus } from '../database/indexMetadata.js';
import {
  emptyRunCounts,
  finishIndexingRun,
  startIndexingRun,
  type IndexingRunKind,
  type RunCounts,
  type RunOutcome,
} from '../database/indexingRuns.js';
import { searchEngine } from '../search/engine.js';
import { LockManager } from '../services/lock/LockManager.js';
import { getLogger } from '../services/logger/logger.js';
import { isCancellation } from './cancellation.js';
import { errorMessage } from './errors.js';
import {
  computeIndexFingerprint,
  getIndexedFingerprint,
  loadIndexingSettings,
  setIndexedFingerprint,
  type IndexingSettings,
} from './indexingSettings.js';
import {
  createDefaultProcessor,
  IndexQueue,
  type IndexQueueProgress,
  type IndexTask,
  type QueueResult,
  type TaskProcessor,
} from './IndexQueue.js';
import { SyncManager, type SyncPhase, type SyncReport } from './SyncManager.js';

/**
 * Live state of the (single) indexing session:
 *
 *   idle → starting → crawling → syncing → indexing → finalizing → idle
 *                         (any) → cancelling → finalizing → idle
 *
 * The persisted outcome of each session (completed / completed_with_errors /
 * failed / cancelled) is recorded in IndexingRuns and IndexMetadata.
 */
export type IndexingPhase =
  | 'idle'
  | 'starting'
  | SyncPhase
  | 'cancelling'
  | 'finalizing';

export type SessionTrigger =
  | 'manual'
  | 'startup'
  | 'scheduled'
  | 'watcher'
  | 'folders'
  | 'settings'
  | 'retry';

export interface SessionResult {
  sessionId: number;
  runId: number | null;
  trigger: SessionTrigger;
  kind: IndexingRunKind;
  outcome: RunOutcome;
  counts: RunCounts;
  durationMs: number;
  error: string | null;
  finishedAt: number;
}

export interface IndexingState {
  phase: IndexingPhase;
  active: boolean;
  sessionId: number | null;
  runId: number | null;
  trigger: SessionTrigger | null;
  kind: IndexingRunKind | null;
  startedAt: number | null;
  queue: IndexQueueProgress;
  lastResult: SessionResult | null;
}

export interface FullSyncRequest {
  /** Re-index every file even if unchanged. */
  force?: boolean;
  /**
   * The request reflects a change (new folder, new rules…) that a session
   * already past its crawl would miss: run another full sync after it.
   * Otherwise a request made during a full sync simply joins it.
   */
  afterCurrent?: boolean;
}

export interface CoordinatorOptions {
  lockManager?: LockManager;
  syncManager?: SyncManager;
  createProcessor?: (ctx: { settings: IndexingSettings; force: boolean }) => TaskProcessor;
  rebuildSearchIndex?: () => void;
}

interface ActiveSession {
  id: number;
  trigger: SessionTrigger;
  kind: IndexingRunKind;
  controller: AbortController;
  startedAt: number;
  runId: number | null;
  cancelRequested: boolean;
  promise: Promise<SessionResult>;
}

interface PendingFullSync {
  trigger: SessionTrigger;
  force: boolean;
  waiters: Array<(result: SessionResult) => void>;
}

const IDLE_QUEUE: IndexQueueProgress = {
  status: 'idle',
  processed: 0,
  total: 0,
  indexedFiles: 0,
  failedTasks: 0,
  pendingTasks: 0,
};

/**
 * Owns indexing sessions. Exactly one session runs at a time; every session —
 * success, zero work, failure, cancellation or exception — goes through the
 * same `finally` block that records the run, updates metadata, releases the
 * lock, refreshes the search index and only then reports idle.
 */
export class IndexingCoordinator {
  private readonly lockManager: LockManager;
  private readonly syncManager: SyncManager;
  private readonly createProcessor: NonNullable<CoordinatorOptions['createProcessor']>;
  private readonly rebuildSearchIndex: () => void;

  private active: ActiveSession | null = null;
  private pendingFull: PendingFullSync | null = null;
  private bufferedTasks = new Map<string, IndexTask>();
  private phase: IndexingPhase = 'idle';
  private queue: IndexQueue | null = null;
  private lastResult: SessionResult | null = null;
  private listeners: Array<(state: IndexingState) => void> = [];
  private sessionSeq = 0;
  private disposed = false;

  constructor(options: CoordinatorOptions = {}) {
    this.lockManager = options.lockManager ?? new LockManager();
    this.syncManager = options.syncManager ?? new SyncManager();
    this.createProcessor =
      options.createProcessor ?? (({ settings, force }) => createDefaultProcessor({ settings, force }));
    this.rebuildSearchIndex = options.rebuildSearchIndex ?? (() => searchEngine.rebuildIndex());
  }

  getState(): IndexingState {
    const session = this.active;
    return {
      phase: this.phase,
      active: session !== null,
      sessionId: session?.id ?? null,
      runId: session?.runId ?? null,
      trigger: session?.trigger ?? null,
      kind: session?.kind ?? null,
      startedAt: session?.startedAt ?? null,
      queue: this.queue?.getProgress() ?? IDLE_QUEUE,
      lastResult: this.lastResult,
    };
  }

  isActive(): boolean {
    return this.active !== null;
  }

  subscribe(listener: (state: IndexingState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Starts a full sync, joins the running one, or schedules one after it. */
  requestFullSync(trigger: SessionTrigger, request: FullSyncRequest = {}): Promise<SessionResult> {
    if (this.disposed) {
      return Promise.reject(new Error('Indexing coordinator has been disposed'));
    }
    const current = this.active;
    if (current) {
      if (current.kind === 'full' && !request.afterCurrent && !request.force) {
        return current.promise;
      }
      return new Promise((resolve) => {
        if (!this.pendingFull) {
          this.pendingFull = { trigger, force: false, waiters: [] };
        }
        this.pendingFull.force ||= Boolean(request.force);
        this.pendingFull.waiters.push(resolve);
      });
    }
    return this.start('full', trigger, { force: Boolean(request.force) });
  }

  /**
   * Processes specific paths (watcher events). While a session is running
   * they are buffered and processed right after it, so no change is lost.
   */
  requestIncremental(tasks: IndexTask[], trigger: SessionTrigger = 'watcher'): Promise<SessionResult> | null {
    if (this.disposed || tasks.length === 0) return null;
    if (this.active) {
      for (const task of tasks) this.bufferedTasks.set(task.path, task);
      return null;
    }
    return this.start('incremental', trigger, { tasks });
  }

  /**
   * Cancels the running session and resolves once it is fully finalized
   * (in-flight work settled, run recorded, lock released). Follow-up work that
   * was queued behind it is dropped; the next full sync reconciles it.
   */
  async cancel(): Promise<SessionResult | null> {
    const session = this.active;
    if (!session) return null;
    if (!session.cancelRequested) {
      session.cancelRequested = true;
      this.setPhase('cancelling');
      session.controller.abort();
    }
    return session.promise;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.pendingFull = null;
    this.bufferedTasks.clear();
    await this.cancel();
  }

  private start(
    kind: IndexingRunKind,
    trigger: SessionTrigger,
    options: { force?: boolean; tasks?: IndexTask[] }
  ): Promise<SessionResult> {
    const session: ActiveSession = {
      id: ++this.sessionSeq,
      trigger,
      kind,
      controller: new AbortController(),
      startedAt: Date.now(),
      runId: null,
      cancelRequested: false,
      promise: Promise.resolve(null as unknown as SessionResult),
    };
    // Set synchronously so concurrent requests observe the active session.
    this.active = session;
    session.promise = this.execute(session, options).then((result) => {
      this.onSessionSettled(session, result);
      return result;
    });
    return session.promise;
  }

  private async execute(
    session: ActiveSession,
    options: { force?: boolean; tasks?: IndexTask[] }
  ): Promise<SessionResult> {
    const signal = session.controller.signal;
    const log = getLogger();
    let lockOwner: string | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let unsubscribeQueue: (() => void) | null = null;
    let outcome: RunOutcome = 'failed';
    let error: string | null = null;
    let counts: RunCounts = emptyRunCounts();
    let report: SyncReport | null = null;
    let fingerprint: string | null = null;

    this.setPhase('starting');
    log.info('index', 'IndexingCoordinator', `Session ${session.id} (${session.kind}, ${session.trigger}) starting`);

    try {
      const owner = `session:${session.id}:${process.pid}:${session.startedAt}`;
      if (!this.lockManager.acquire(owner, { trigger: session.trigger })) {
        throw new Error('The index is locked by another Echo process');
      }
      lockOwner = owner;
      const renewEvery = Math.max(1000, Math.floor(this.lockManager.getTtlMs() / 3));
      heartbeat = setInterval(() => {
        try {
          this.lockManager.renew(owner);
        } catch (err) {
          log.error('index', 'IndexingCoordinator', `Lock renewal failed: ${errorMessage(err)}`);
        }
      }, renewEvery);
      heartbeat.unref?.();

      session.runId = startIndexingRun(session.trigger, session.kind, session.startedAt);
      setIndexingStatus('indexing');

      const settings = loadIndexingSettings();
      let force = Boolean(options.force);
      if (session.kind === 'full') {
        fingerprint = computeIndexFingerprint(settings);
        const stored = getIndexedFingerprint();
        if (stored === fingerprint) {
          fingerprint = null; // Already current; nothing to record later.
        } else if (stored === undefined && getFileCount() === 0) {
          // Empty index: everything written from now on uses this config.
          setIndexedFingerprint(fingerprint);
          fingerprint = null;
        } else {
          // Built with another (or unknown) config: re-index everything and
          // record the new fingerprint only once that has completed.
          force = true;
        }
      }

      const queue = new IndexQueue(this.createProcessor({ settings, force }));
      this.queue = queue;
      unsubscribeQueue = queue.subscribe(() => this.emit());

      if (session.kind === 'full') {
        report = await this.syncManager.sync({
          queue,
          settings,
          signal,
          force,
          onPhase: (phase) => {
            if (!signal.aborted) this.setPhase(phase);
          },
        });
        counts = report.counts;
      } else {
        this.setPhase('indexing');
        queue.enqueueMany(options.tasks ?? []);
        counts = countsFromQueue(await queue.run(signal));
      }

      if (signal.aborted) {
        outcome = 'cancelled';
      } else {
        outcome = counts.failed > 0 ? 'completed_with_errors' : 'completed';
      }
    } catch (err) {
      if (signal.aborted || isCancellation(err)) {
        outcome = 'cancelled';
      } else {
        outcome = 'failed';
        error = errorMessage(err);
        log.error('index', 'IndexingCoordinator', `Session ${session.id} failed: ${error}`);
      }
      if (!report && this.queue) {
        // Work committed before the failure/cancellation is still reported.
        counts = countsFromQueue(this.queue.getCounts());
      }
    } finally {
      // ---- Single finalization path. Every step is isolated so one failure
      // cannot prevent the lock release or the transition back to idle. ----
      if (!session.cancelRequested) this.setPhase('finalizing');
      if (heartbeat) clearInterval(heartbeat);
      unsubscribeQueue?.();
      const durationMs = Date.now() - session.startedAt;
      const succeeded = outcome === 'completed' || outcome === 'completed_with_errors';

      guard('record run', () => {
        if (session.runId !== null) {
          finishIndexingRun(session.runId, outcome, durationMs, counts, error);
        }
      });

      guard('record metadata', () => {
        if (session.runId !== null) {
          recordSessionFinished({
            runId: session.runId,
            kind: session.kind,
            outcome,
            durationMs,
            errorMessage: error,
            crawlCounts:
              succeeded && report
                ? {
                    ignored: report.crawl.ignored,
                    unsupported: report.crawl.unsupported,
                    oversized: report.crawl.oversized,
                    inaccessible: report.crawl.inaccessible,
                  }
                : undefined,
            syncedAt: session.startedAt,
          });
        } else if (lockOwner) {
          // The run could not even be recorded (database problem).
          setIndexingStatus('error', error ?? 'Indexing failed');
        }
      });

      guard('mark folders synced', () => {
        if (succeeded && report) {
          markFoldersSynced(report.syncedFolderIds, session.startedAt);
          const enabled = getEnabledFolders().length;
          if (fingerprint && report.syncedFolderIds.length === enabled) {
            setIndexedFingerprint(fingerprint);
          }
        }
      });

      guard('release lock', () => {
        if (lockOwner) this.lockManager.release(lockOwner);
      });

      guard('rebuild search index', () => this.rebuildSearchIndex());

      this.queue = null;
      log.info(
        'index',
        'IndexingCoordinator',
        `Session ${session.id} finished: ${outcome} in ${durationMs}ms ${JSON.stringify(counts)}`
      );
    }

    const result: SessionResult = {
      sessionId: session.id,
      runId: session.runId,
      trigger: session.trigger,
      kind: session.kind,
      outcome,
      counts,
      durationMs: Date.now() - session.startedAt,
      error,
      finishedAt: Date.now(),
    };
    this.lastResult = result;
    return result;
  }

  /** Runs after finalization: report idle, then start any follow-up work. */
  private onSessionSettled(session: ActiveSession, result: SessionResult): void {
    if (this.active === session) this.active = null;
    this.setPhase('idle');

    if (this.disposed) return;

    if (session.cancelRequested) {
      this.bufferedTasks.clear();
      const pending = this.pendingFull;
      this.pendingFull = null;
      pending?.waiters.forEach((resolve) => resolve(result));
      return;
    }

    if (this.pendingFull) {
      const pending = this.pendingFull;
      this.pendingFull = null;
      // A full sync reconciles everything the buffered events refer to.
      this.bufferedTasks.clear();
      void this.start('full', pending.trigger, { force: pending.force }).then((next) =>
        pending.waiters.forEach((resolve) => resolve(next))
      );
      return;
    }

    if (this.bufferedTasks.size > 0) {
      const tasks = Array.from(this.bufferedTasks.values());
      this.bufferedTasks.clear();
      void this.start('incremental', 'watcher', { tasks });
    }
  }

  private setPhase(phase: IndexingPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit();
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        getLogger().error('index', 'IndexingCoordinator', `State listener failed: ${errorMessage(err)}`);
      }
    }
  }
}

function guard(step: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    getLogger().error('index', 'IndexingCoordinator', `Finalization step "${step}" failed: ${errorMessage(err)}`);
  }
}

function countsFromQueue(result: QueueResult): RunCounts {
  return {
    ...emptyRunCounts(),
    added: result.added,
    modified: result.modified,
    deleted: result.deleted,
    unchanged: result.unchanged,
    skipped: result.skipped,
    failed: result.failed,
    indexed: result.indexed,
  };
}
