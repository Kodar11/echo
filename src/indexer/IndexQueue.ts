import { deleteSingleFile, indexSingleFile } from './singleFileIndexer.js';

export type IndexTaskType = 'index' | 'delete';

export interface IndexTask {
  type: IndexTaskType;
  path: string;
}

export interface IndexQueueProgress {
  status: 'idle' | 'running' | 'error';
  currentFile?: string;
  processed: number;
  total: number;
  indexedFiles: number;
  pendingTasks: number;
  error?: string;
}

export type ProgressCallback = (progress: IndexQueueProgress) => void;

export class IndexQueue {
  private pending = new Map<string, IndexTask>();
  private inFlightPath: string | null = null;
  private isProcessing = false;
  private processed = 0;
  private total = 0;
  private indexedFiles = 0;
  private status: IndexQueueProgress['status'] = 'idle';
  private error?: string;
  private callbacks: ProgressCallback[] = [];
  private onIdle?: () => void;

  constructor(options?: { onIdle?: () => void }) {
    this.onIdle = options?.onIdle;
  }

  subscribe(callback: ProgressCallback): () => void {
    this.callbacks.push(callback);
    callback(this.getProgress());
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  private notify(): void {
    const progress = this.getProgress();
    for (const callback of this.callbacks) {
      callback(progress);
    }
  }

  enqueue(task: IndexTask): void {
    this.startNewBatchIfIdle();

    const existing = this.pending.get(task.path) ??
      (this.inFlightPath === task.path
        ? { type: task.type, path: task.path }
        : undefined);

    if (existing) {
      // Coalesce: index wins over delete if both are pending.
      if (task.type === 'index') {
        this.pending.set(task.path, task);
      }
      return;
    }

    this.pending.set(task.path, task);
    this.total++;
    this.notify();
    this.processNext();
  }

  enqueueMany(tasks: IndexTask[]): void {
    if (tasks.length === 0) return;

    this.startNewBatchIfIdle();

    let added = 0;
    for (const task of tasks) {
      const existing = this.pending.get(task.path) ??
        (this.inFlightPath === task.path
          ? { type: task.type, path: task.path }
          : undefined);

      if (existing) {
        if (task.type === 'index') {
          this.pending.set(task.path, task);
        }
        continue;
      }

      this.pending.set(task.path, task);
      added++;
    }

    if (added === 0) return;

    this.total += added;
    this.notify();
    this.processNext();
  }

  clear(): void {
    this.pending.clear();
    this.inFlightPath = null;
    this.isProcessing = false;
    this.processed = 0;
    this.total = 0;
    this.indexedFiles = 0;
    this.error = undefined;
    if (this.status !== 'idle') {
      this.status = 'idle';
      this.notify();
    }
  }

  getProgress(): IndexQueueProgress {
    return {
      status: this.status,
      currentFile: this.inFlightPath ?? undefined,
      processed: this.processed,
      total: this.total,
      indexedFiles: this.indexedFiles,
      pendingTasks: this.pending.size + (this.inFlightPath ? 1 : 0),
      error: this.error,
    };
  }

  private startNewBatchIfIdle(): void {
    if (this.status === 'idle' && this.pending.size === 0 && !this.inFlightPath) {
      this.processed = 0;
      this.total = 0;
      this.indexedFiles = 0;
      this.error = undefined;
    }
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    if (this.pending.size === 0) {
      if (this.status === 'running') {
        this.status = 'idle';
        this.inFlightPath = null;
        this.notify();
        this.onIdle?.();
      }
      return;
    }

    this.isProcessing = true;
    this.status = 'running';

    const [path, task] = this.pending.entries().next().value as [
      string,
      IndexTask,
    ];
    this.pending.delete(path);
    this.inFlightPath = path;
    this.notify();

    try {
      if (task.type === 'index') {
        const indexed = await indexSingleFile(task.path);
        if (indexed) {
          this.indexedFiles++;
        }
      } else if (task.type === 'delete') {
        deleteSingleFile(task.path);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `IndexQueue task failed (${task.type} ${task.path}):`,
        message
      );
      this.error = message;
      this.status = 'error';
      this.notify();
    } finally {
      this.processed++;
      this.inFlightPath = null;
      this.isProcessing = false;
      this.notify();
      this.processNext();
    }
  }

}
