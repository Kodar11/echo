type ProgressCallback = (progress: IndexingProgress) => void;

export class IndexingProgressTracker {
  private progress: IndexingProgress = {
    status: 'idle',
    processed: 0,
    total: 0,
    indexedFiles: 0,
  };
  private callbacks: ProgressCallback[] = [];

  subscribe(callback: ProgressCallback): () => void {
    this.callbacks.push(callback);
    callback(this.progress);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  private notify(): void {
    for (const callback of this.callbacks) {
      callback(this.progress);
    }
  }

  start(total: number): void {
    this.progress = {
      status: 'running',
      processed: 0,
      total,
      indexedFiles: 0,
    };
    this.notify();
  }

  setCurrentFile(filePath: string): void {
    this.progress.currentFile = filePath;
    this.notify();
  }

  incrementProcessed(): void {
    this.progress.processed++;
    this.notify();
  }

  setIndexedFiles(count: number): void {
    this.progress.indexedFiles = count;
    this.notify();
  }

  complete(): void {
    this.progress.status = 'completed';
    this.progress.currentFile = undefined;
    this.notify();
  }

  error(message: string): void {
    this.progress.status = 'error';
    this.progress.error = message;
    this.notify();
  }

  getProgress(): IndexingProgress {
    return { ...this.progress };
  }
}
