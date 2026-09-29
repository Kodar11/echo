import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { ignoreRuleManager } from '../services/ignore/IgnoreRuleManager.js';
import { getLogger } from '../services/logger/logger.js';
import { CancelledError } from './cancellation.js';
import { errorMessage, isNotFoundError } from './errors.js';
import { loadIndexingSettings, type IndexingSettings } from './indexingSettings.js';
import { isHiddenName } from './paths.js';

export interface DiskFileState {
  size: number;
  /** Integer milliseconds (fs mtimeMs truncated), matching Files.modified_time. */
  mtimeMs: number;
}

export interface CrawlError {
  path: string;
  message: string;
  code?: string;
  isDirectory: boolean;
}

export interface CrawlResult {
  root: string;
  /** False when the root itself could not be read (missing, offline, denied). */
  rootAccessible: boolean;
  /** Indexable files: supported extension, within the size limit, not ignored. */
  files: Map<string, DiskFileState>;
  /** Entries excluded by ignore rules or because they are hidden. */
  ignoredCount: number;
  unsupportedCount: number;
  oversizedCount: number;
  /** Symbolic links / junctions, which are not followed. */
  symlinkCount: number;
  errors: CrawlError[];
  /**
   * Directories and files whose state is unknown because they could not be
   * read. Existing index entries at or below these paths must be kept.
   */
  unreadablePaths: string[];
}

export interface CrawlOptions {
  signal?: AbortSignal;
  settings?: IndexingSettings;
  /** Directories read concurrently. */
  concurrency?: number;
}

const DEFAULT_CONCURRENCY = 8;
const STAT_BATCH = 32;

/**
 * Walks `root` and collects the indexable files with their size/mtime.
 * Unreadable entries are recorded instead of aborting the crawl.
 */
export async function crawlDirectory(
  root: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const { signal } = options;
  const settings = options.settings ?? loadIndexingSettings();
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);

  const result: CrawlResult = {
    root,
    rootAccessible: true,
    files: new Map(),
    ignoredCount: 0,
    unsupportedCount: 0,
    oversizedCount: 0,
    symlinkCount: 0,
    errors: [],
    unreadablePaths: [],
  };

  try {
    const rootStats = await fs.stat(root);
    if (!rootStats.isDirectory()) {
      throw Object.assign(new Error(`Not a directory: ${root}`), { code: 'ENOTDIR' });
    }
  } catch (err) {
    result.rootAccessible = false;
    result.unreadablePaths.push(root);
    result.errors.push(toCrawlError(root, err, true));
    getLogger().warn('index', 'crawler', `Cannot access folder ${root}: ${errorMessage(err)}`);
    return result;
  }

  const readDirectory = async (dir: string, subdirs: string[]): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (dir === root) result.rootAccessible = false;
      result.unreadablePaths.push(dir);
      result.errors.push(toCrawlError(dir, err, true));
      getLogger().warn('index', 'crawler', `Cannot read directory ${dir}: ${errorMessage(err)}`);
      return;
    }

    const candidates: string[] = [];
    for (const entry of entries) {
      if (settings.skipHidden && isHiddenName(entry.name)) {
        result.ignoredCount++;
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        // Not followed: avoids loops and indexing content outside the folder.
        result.symlinkCount++;
        continue;
      }
      if (ignoreRuleManager.shouldIgnore(fullPath, root)) {
        result.ignoredCount++;
        continue;
      }
      if (entry.isDirectory()) {
        subdirs.push(fullPath);
      } else if (entry.isFile()) {
        if (extractorManager.isSupportedFile(fullPath)) {
          candidates.push(fullPath);
        } else {
          result.unsupportedCount++;
        }
      }
    }

    for (let i = 0; i < candidates.length; i += STAT_BATCH) {
      if (signal?.aborted) return;
      await Promise.all(candidates.slice(i, i + STAT_BATCH).map((file) => statCandidate(file)));
    }
  };

  const statCandidate = async (filePath: string): Promise<void> => {
    try {
      const stats = await fs.stat(filePath);
      if (settings.maxFileSizeBytes > 0 && stats.size > settings.maxFileSizeBytes) {
        result.oversizedCount++;
        return;
      }
      result.files.set(filePath, { size: stats.size, mtimeMs: Math.trunc(stats.mtimeMs) });
    } catch (err) {
      if (isNotFoundError(err)) return; // Deleted between readdir and stat.
      result.unreadablePaths.push(filePath);
      result.errors.push(toCrawlError(filePath, err, false));
    }
  };

  // Bounded-concurrency traversal over a shared work list.
  const pendingDirs: string[] = [root];
  await new Promise<void>((resolve, reject) => {
    let active = 0;
    let settled = false;
    const pump = () => {
      if (settled) return;
      if (signal?.aborted) {
        if (active === 0) {
          settled = true;
          reject(new CancelledError());
        }
        return;
      }
      while (active < concurrency && pendingDirs.length > 0) {
        const dir = pendingDirs.pop() as string;
        const subdirs: string[] = [];
        active++;
        readDirectory(dir, subdirs)
          .then(() => {
            pendingDirs.push(...subdirs);
          })
          .catch((err) => {
            // readDirectory records its own errors; this is unexpected.
            result.errors.push(toCrawlError(dir, err, true));
            result.unreadablePaths.push(dir);
          })
          .finally(() => {
            active--;
            pump();
          });
      }
      if (active === 0 && pendingDirs.length === 0) {
        settled = true;
        resolve();
      }
    };
    pump();
  });

  return result;
}

function toCrawlError(filePath: string, err: unknown, isDirectory: boolean): CrawlError {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string'
      ? ((err as { code: string }).code)
      : undefined;
  return { path: filePath, message: errorMessage(err), code, isDirectory };
}
