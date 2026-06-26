import fs from 'fs/promises';
import { getAllFilePaths } from '../database/files.js';
import { getEnabledFolders } from '../database/folders.js';
import { recordSyncCompleted, setIgnoredFilesCount } from '../database/indexMetadata.js';
import { getLogger } from '../services/logger/logger.js';
import { crawlDirectory } from './crawler.js';
import type { IndexQueue, IndexTask } from './IndexQueue.js';

export interface SyncResult {
  toIndex: number;
  toDelete: number;
  total: number;
}

export class SyncManager {
  constructor(private queue: IndexQueue) {}

  async sync(options: { trigger?: 'startup' | 'manual' | 'scheduled' } = {}): Promise<SyncResult> {
    const folders = getEnabledFolders();
    const diskFiles = new Map<string, { size: number; mtimeMs: number }>();
    let totalIgnored = 0;

    for (const folder of folders) {
      try {
        const { files, ignoredCount } = await crawlDirectory(folder.path);
        totalIgnored += ignoredCount;
        for (const filePath of files) {
          try {
            const stats = await this.statFile(filePath);
            if (stats) {
              diskFiles.set(filePath, stats);
            }
          } catch {
            // Ignore files we can't stat.
          }
        }
      } catch {
        // Ignore folders we can't crawl.
      }
    }

    setIgnoredFilesCount(totalIgnored);

    const dbFiles = new Map<string, { size: number; modified_time: number }>();
    for (const file of getAllFilePaths()) {
      dbFiles.set(file.path, file);
    }

    const tasks: IndexTask[] = [];

    for (const [filePath, diskStats] of diskFiles.entries()) {
      const dbRecord = dbFiles.get(filePath);
      if (
        !dbRecord ||
        dbRecord.size !== diskStats.size ||
        dbRecord.modified_time !== diskStats.mtimeMs
      ) {
        tasks.push({ type: 'index', path: filePath });
      }
    }

    // Delete files that are no longer on disk or belong to disabled folders.
    for (const filePath of dbFiles.keys()) {
      if (!diskFiles.has(filePath)) {
        tasks.push({ type: 'delete', path: filePath });
      }
    }

    if (tasks.length > 0) {
      this.queue.enqueueMany(tasks);
    }

    recordSyncCompleted();
    getLogger().info(
      'index',
      'SyncManager',
      `Sync complete: ${tasks.filter((t) => t.type === 'index').length} to index, ${tasks.filter((t) => t.type === 'delete').length} to delete`
    );

    return {
      toIndex: tasks.filter((t) => t.type === 'index').length,
      toDelete: tasks.filter((t) => t.type === 'delete').length,
      total: tasks.length,
    };
  }

  private async statFile(
    filePath: string
  ): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const stats = await fs.stat(filePath);
      return { size: stats.size, mtimeMs: stats.mtimeMs };
    } catch {
      return null;
    }
  }
}
