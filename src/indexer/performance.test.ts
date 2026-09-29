import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addFolder } from '../database/folders.js';
import { writeFileIndex } from '../database/indexWriter.js';
import { searchEngine } from '../search/engine.js';
import { createTestEnvironment, type TestEnvironment } from '../test/fixtures.js';
import { IndexingCoordinator } from './IndexingCoordinator.js';

/**
 * Coarse guardrails against pathological slowdowns. Bounds are generous on
 * purpose; they catch O(n²) regressions, not micro-level drift.
 */
describe('performance guardrails', () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => env.cleanup());

  it('indexes a folder of 2,000 small text files and re-syncs it cheaply', async () => {
    for (let i = 0; i < 2000; i++) {
      env.file(`dir${i % 20}/note${i}.txt`, `note ${i} about topic${i % 50} and shared vocabulary words`);
    }
    addFolder(env.root);
    const coordinator = new IndexingCoordinator();

    let start = performance.now();
    const first = await coordinator.requestFullSync('manual');
    const firstMs = performance.now() - start;
    expect(first.counts.indexed).toBe(2000);
    expect(firstMs).toBeLessThan(60_000);

    start = performance.now();
    const second = await coordinator.requestFullSync('manual');
    const secondMs = performance.now() - start;
    expect(second.counts).toMatchObject({ unchanged: 2000, indexed: 0 });
    // No hashing or extraction for unchanged files: far cheaper than the first run.
    expect(secondMs).toBeLessThan(firstMs / 2);
    console.log(`2000 files: first sync ${firstMs.toFixed(0)}ms, unchanged re-sync ${secondMs.toFixed(0)}ms`);
  }, 120_000);

  it('bounds fuzzy/prefix expansion on a large vocabulary', async () => {
    const positions = new Map<string, number[]>();
    for (let i = 0; i < 100_000; i++) positions.set(`term${i.toString(36)}x`, [i]);
    writeFileIndex({
      path: 'C:\\big\\vocab.txt',
      size: 1,
      modifiedTime: 0,
      docLength: positions.size,
      language: null,
      contentHash: 'h',
      author: null,
      createdAt: null,
      extension: '.txt',
      positions,
    });
    searchEngine.rebuildIndex();

    for (const query of ['termzzzzzq', 'te', 'term', 'NOT term1x', 'termabcx OR termqqqq']) {
      const start = performance.now();
      const response = await searchEngine.search({ query });
      const ms = performance.now() - start;
      expect(response.error).toBeUndefined();
      expect(ms).toBeLessThan(2_000);
    }
  }, 60_000);
});
