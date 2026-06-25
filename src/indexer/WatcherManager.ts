import { watch, type FSWatcher } from 'chokidar';
import type { FolderRecord } from '../database/folders.js';
import type { IndexQueue, IndexTask } from './IndexQueue.js';
import type { SyncManager } from './SyncManager.js';

const DEBOUNCE_MS = 300;

export class WatcherManager {
  private watcher: FSWatcher | null = null;
  private pending = new Map<string, IndexTask['type']>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private queue: IndexQueue,
    private syncManager: SyncManager
  ) {}

  start(folders: FolderRecord[]): void {
    this.stop();

    const paths = folders
      .filter((folder) => folder.enabled)
      .map((folder) => folder.path);

    if (paths.length === 0) return;

    this.watcher = watch(paths, {
      ignored: /(^|[\/\\])\../,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => this.onChange(filePath, 'index'));
    this.watcher.on('change', (filePath) => this.onChange(filePath, 'index'));
    this.watcher.on('unlink', (filePath) => this.onChange(filePath, 'delete'));
    this.watcher.on('unlinkDir', (dirPath) => this.onUnlinkDir(dirPath));
    this.watcher.on('error', (error) => {
      console.error('Watcher error:', error);
    });
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.watcher) {
      this.watcher.close().catch(() => {});
      this.watcher = null;
    }
    this.pending.clear();
  }

  restart(folders: FolderRecord[]): void {
    this.start(folders);
  }

  private onChange(filePath: string, type: IndexTask['type']): void {
    // Coalesce delete -> index transitions and vice versa.
    this.pending.set(filePath, type);
    this.scheduleFlush();
  }

  private onUnlinkDir(_dirPath: string): void {
    // Watchers can miss bulk deletes, so schedule a full sync to clean up.
    this.syncManager.sync({ trigger: 'manual' }).catch((err) => {
      console.error('Watcher sync failed:', err);
    });
  }

  private scheduleFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  private flush(): void {
    if (this.pending.size === 0) return;

    const tasks: IndexTask[] = [];
    for (const [filePath, type] of this.pending.entries()) {
      tasks.push({ type, path: filePath });
    }
    this.pending.clear();

    this.queue.enqueueMany(tasks);
  }
}
