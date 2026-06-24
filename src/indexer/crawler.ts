import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { isSupportedFile } from '../file-extractors/registry.js';

export interface CrawlOptions {
  skipHidden?: boolean;
}

export async function crawlDirectory(
  root: string,
  options: CrawlOptions = {}
): Promise<string[]> {
  const results: string[] = [];
  const { skipHidden = true } = options;

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (skipHidden && entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  await walk(root);
  return results;
}
