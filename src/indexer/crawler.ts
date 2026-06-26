import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { getSetting } from '../database/settings.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { ignoreRuleManager } from '../services/ignore/IgnoreRuleManager.js';
import { getLogger } from '../services/logger/logger.js';

export interface CrawlOptions {
  skipHidden?: boolean;
}

export interface CrawlResult {
  files: string[];
  ignoredCount: number;
}

export async function crawlDirectory(
  root: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const results: string[] = [];
  let ignoredCount = 0;
  const { skipHidden = true } = options;
  const maxFileSizeBytes = getMaxFileSizeBytes();

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      getLogger().warn(
        'index',
        'crawler',
        `Cannot read directory ${dir}: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (ignoreRuleManager.shouldIgnore(fullPath)) {
        ignoredCount++;
        continue;
      }
      if (skipHidden && entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (!extractorManager.isSupportedFile(fullPath)) continue;

        if (maxFileSizeBytes > 0) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > maxFileSizeBytes) {
              getLogger().info(
                'index',
                'crawler',
                `Skipping large file ${fullPath} (${stats.size} bytes)`
              );
              continue;
            }
          } catch {
            continue;
          }
        }

        results.push(fullPath);
      }
    }
  }

  await walk(root);
  return { files: results, ignoredCount };
}

function getMaxFileSizeBytes(): number {
  const raw = getSetting(SETTING_KEYS.maxFileSizeBytes);
  if (!raw) return 0;
  const value = parseInt(raw, 10);
  return isNaN(value) ? 0 : value;
}
