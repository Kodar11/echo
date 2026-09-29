import { getLogger } from '../services/logger/logger.js';
import { errorMessage } from './errors.js';
import {
  deleteSingleFile,
  indexSingleFile,
  type IndexFileOptions,
  type TaskOutcome,
} from './singleFileIndexer.js';

export type IndexTaskType = 'index' | 'delete';

export interface IndexTask {
  type: IndexTaskType;
  path: string;
  /** Why the task exists (from change detection); used for run statistics. */
  change?: 'added' | 'modified';
}

export type QueueStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'cancelled'
  | 'failed';

export interface IndexQueueProgress {
  status: QueueStatus;
  currentFile?: string;
  processed: number;
  total: number;
  indexedFiles: number;
  failedTasks: number;
  pendingTasks: number;
  error?: string;
}

export interface QueueResult {
  status: Exclude<QueueStatus, 'idle' | 'running'>;
  total: number;
  processed: number;
  indexed: number;
  added: number;
  modified: number;
  unchanged: number;
  deleted: number;
  skipped: number;
  failed: number;
  /** Tasks that were never started because of cancellation. */
  cancelled: number;
  error?: string;
}

export type ProgressCallback = (progress: IndexQueueProgress) => void;

export type TaskProcessor = (
  task: IndexTask,
  signal: AbortSignal | undefined
) => Promise<TaskOutcome>;

export class QueueFatalError extends Error {}

/** Consecutive database errors after which the session is aborted as failed. */
const MAX_CONSECUTIVE_DATABASE_ERRORS = 5;
const PROGRESS_THROTTLE_MS = 100;

export function createDefaultProcessor(
  options: Omit<IndexFileOptions, 'signal'> = {}
): TaskProcessor {
  return (task, signal) =>
    task.type === 'index'
      ? indexSingleFile(task.path, { ...options, signal })
      : Promise.resolve(deleteSingleFile(task.path, signal));
}

/**
 * Sequential work queue for one indexing session.
 *
 * - Tasks for the same path are coalesced (the latest request wins; an index
 *   task for a missing file removes it, so either order converges).
 * - `run()` resolves when every task has settled, including when there are
 *   no tasks at all, and reports what happened to each.
 * - Aborting the signal stops before the next task; the in-flight task
 *   observes the same signal and does not commit.
 */
export class IndexQueue {
  private pending = new Map<string, IndexTask>();
  private inFlightPath: string | null = null;
  private running = false;
  private status: QueueStatus = 'idle';
  private error?: string;
  private callbacks: ProgressCallback[] = [];
  private lastNotify = 0;
  private result: QueueResult = emptyResult();

  constructor(private readonly processor: TaskProcessor = createDefaultProcessor()) {}

  subscribe(callback: ProgressCallback): () => void {
    this.callbacks.push(callback);
    callback(this.getProgress());
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  enqueue(task: IndexTask): void {
    this.enqueueMany([task]);
  }

  enqueueMany(tasks: IndexTask[]): void {
    for (const task of tasks) {
      if (!this.pending.has(task.path)) {
        this.result.total++;
      }
      // Delete + re-add keeps insertion order meaningful for the latest task.
      this.pending.delete(task.path);
      this.pending.set(task.path, task);
    }
    if (tasks.length > 0) this.notify(true);
  }

  getProgress(): IndexQueueProgress {
    return {
      status: this.status,
      currentFile: this.inFlightPath ?? undefined,
      processed: this.result.processed,
      total: this.result.total,
      indexedFiles: this.result.indexed,
      failedTasks: this.result.failed,
      pendingTasks: this.pending.size + (this.inFlightPath ? 1 : 0),
      error: this.error,
    };
  }

  /** Snapshot of the outcome counters so far. */
  getCounts(): QueueResult {
    return { ...this.result, status: this.status === 'idle' || this.status === 'running' ? 'completed' : this.status };
  }

  /**
   * Processes all pending tasks (and any enqueued while running) and resolves
   * with the outcome. Throws QueueFatalError if the database keeps failing.
   */
  async run(signal?: AbortSignal): Promise<QueueResult> {
    if (this.running) {
      throw new Error('IndexQueue.run() is already in progress');
    }
    this.running = true;
    this.status = 'running';
    this.notify(true);

    let consecutiveDbErrors = 0;
    try {
      while (this.pending.size > 0) {
        if (signal?.aborted) break;

        const [taskPath, task] = this.pending.entries().next().value as [string, IndexTask];
        this.pending.delete(taskPath);
        this.inFlightPath = taskPath;
        this.notify(false);

        let outcome: TaskOutcome;
        try {
          outcome = await this.processor(task, signal);
        } catch (err) {
          const message = errorMessage(err);
          getLogger().error('index', 'IndexQueue', `Task ${task.type} ${task.path} threw: ${message}`);
          outcome = { status: 'failed', message };
        }
        this.inFlightPath = null;

        if (outcome.status === 'cancelled') {
          // Not processed: the work was abandoned before committing.
          this.result.cancelled++;
          break;
        }
        this.tally(task, outcome);

        if (outcome.status === 'failed' && outcome.category === 'database_error') {
          consecutiveDbErrors++;
          if (consecutiveDbErrors >= MAX_CONSECUTIVE_DATABASE_ERRORS) {
            throw new QueueFatalError(
              `Aborting: ${consecutiveDbErrors} consecutive database errors (last: ${outcome.message})`
            );
          }
        } else {
          consecutiveDbErrors = 0;
        }

        this.notify(false);
        // Yield so IPC, watcher events and searches stay responsive.
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      if (signal?.aborted) {
        this.result.cancelled += this.pending.size;
        this.pending.clear();
        this.status = 'cancelled';
      } else {
        this.status = this.result.failed > 0 ? 'completed_with_errors' : 'completed';
      }
    } catch (err) {
      this.error = errorMessage(err);
      this.result.cancelled += this.pending.size;
      this.pending.clear();
      this.status = 'failed';
      throw err;
    } finally {
      this.inFlightPath = null;
      this.running = false;
      this.notify(true);
    }

    return { ...this.result, status: this.status as QueueResult['status'] };
  }

  private tally(task: IndexTask, outcome: TaskOutcome): void {
    const r = this.result;
    r.processed++;
    switch (outcome.status) {
      case 'indexed':
        r.indexed++;
        if ((outcome.change ?? task.change) === 'modified') r.modified++;
        else r.added++;
        break;
      case 'unchanged':
        r.unchanged++;
        break;
      case 'deleted':
        r.deleted++;
        break;
      case 'skipped':
        r.skipped++;
        break;
      case 'failed':
        r.failed++;
        break;
    }
  }

  private notify(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastNotify < PROGRESS_THROTTLE_MS) return;
    this.lastNotify = now;
    const progress = this.getProgress();
    for (const callback of this.callbacks) {
      try {
        callback(progress);
      } catch (err) {
        getLogger().error('index', 'IndexQueue', `Progress callback failed: ${errorMessage(err)}`);
      }
    }
  }
}

function emptyResult(): QueueResult {
  return {
    status: 'completed',
    total: 0,
    processed: 0,
    indexed: 0,
    added: 0,
    modified: 0,
    unchanged: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
  };
}
