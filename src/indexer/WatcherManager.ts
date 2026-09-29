import { watch, type FSWatcher } from 'chokidar';
import path from 'path';
import type { FolderRecord } from '../database/folders.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { ignoreRuleManager } from '../services/ignore/IgnoreRuleManager.js';
import { getLogger } from '../services/logger/logger.js';
import type { IndexTask } from './IndexQueue.js';
import { hasHiddenSegment, isPathInside } from './paths.js';

export interface WatcherCallbacks {
  /** Debounced batch of changed paths. */
  onTasks: (tasks: IndexTask[]) => void;
  /** A directory disappeared; its indexed files must be removed. */
  onDirectoryRemoved?: (dirPath: string) => void;
}

const DEBOUNCE_MS = 300;

/**
 * Watches the enabled folders and reports changes. It never touches the
 * index itself: the coordinator decides when the tasks run (immediately, or
 * after the current session so changes made during a sync are not lost).
 */
export class WatcherManager {
  private watcher: FSWatcher | null = null;
  private roots: string[] = [];
  private pending = new Map<string, IndexTask['type']>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private callbacks: WatcherCallbacks) {}

  isWatching(): boolean {
    return this.watcher !== null;
  }

  start(folders: FolderRecord[]): void {
    this.stop();

    this.roots = folders.filter((folder) => folder.enabled).map((folder) => folder.path);
    if (this.roots.length === 0) return;

    this.watcher = watch(this.roots, {
      ignored: (filePath: string) => this.isExcluded(filePath),
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => this.onChange(filePath, 'index'));
    this.watcher.on('change', (filePath) => this.onChange(filePath, 'index'));
    this.watcher.on('unlink', (filePath) => this.onChange(filePath, 'delete'));
    this.watcher.on('unlinkDir', (dirPath) => {
      this.flush();
      this.callbacks.onDirectoryRemoved?.(dirPath);
    });
    this.watcher.on('error', (error) => {
      getLogger().error('watcher', 'WatcherManager', String(error));
    });

    getLogger().info('watcher', 'WatcherManager', `Watching ${this.roots.length} folder(s)`);
  }

  /**
   * @param flush hand over changes observed but not yet reported (used when
   *   restarting for new folders/rules). Shutdown and reset drop them.
   */
  stop(flush = true): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (flush) this.flush();
    else this.pending.clear();
    if (this.watcher) {
      this.watcher.close().catch((err) => {
        getLogger().error('watcher', 'WatcherManager', `Failed to close watcher: ${String(err)}`);
      });
      this.watcher = null;
    }
    this.roots = [];
  }

  private rootFor(filePath: string): string | undefined {
    return this.roots.find((root) => isPathInside(filePath, root));
  }

  private isExcluded(filePath: string): boolean {
    const root = this.rootFor(filePath);
    if (!root) return false;
    if (hasHiddenSegment(filePath, root)) return true;
    return ignoreRuleManager.shouldIgnore(filePath, root);
  }

  private onChange(filePath: string, type: IndexTask['type']): void {
    const normalized = path.resolve(filePath);
    if (this.isExcluded(normalized)) return;
    if (type === 'index' && !extractorManager.isSupportedFile(normalized)) return;

    // Latest event wins; the indexer re-checks the disk either way.
    this.pending.set(normalized, type);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending.size === 0) return;

    const tasks: IndexTask[] = [];
    for (const [filePath, type] of this.pending) {
      tasks.push({ type, path: filePath });
    }
    this.pending.clear();

    try {
      this.callbacks.onTasks(tasks);
    } catch (err) {
      getLogger().error('watcher', 'WatcherManager', `Failed to hand over changes: ${String(err)}`);
    }
  }
}
