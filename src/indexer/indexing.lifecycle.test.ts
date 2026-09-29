import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../database/connection.js';
import { getFileByPath } from '../database/files.js';
import { addFolder, getFolderById, removeFolder } from '../database/folders.js';
import { getIndexMetadata } from '../database/indexMetadata.js';
import { getIndexingFailure } from '../database/indexingFailures.js';
import { getIndexingRun, getRecentIndexingRuns } from '../database/indexingRuns.js';
import { setBooleanSetting, setSetting } from '../database/settings.js';
import { findDuplicateGroups } from '../search/duplicates.js';
import { searchEngine } from '../search/engine.js';
import { IntegrityManager } from '../services/integrity/IntegrityManager.js';
import { LockManager } from '../services/lock/LockManager.js';
import { SETTING_KEYS } from '../settings/keys.js';
import {
  count,
  createDocx,
  createPdf,
  createTestEnvironment,
  deferred,
  documentFrequencyMismatches,
  type TestEnvironment,
} from '../test/fixtures.js';
import { IndexingCoordinator, type IndexingPhase } from './IndexingCoordinator.js';
import { createDefaultProcessor, type TaskProcessor } from './IndexQueue.js';
import { SyncManager } from './SyncManager.js';

async function search(query: string, folderIds?: number[]) {
  return searchEngine.search({ query, folderIds });
}

async function paths(query: string): Promise<string[]> {
  const response = await search(query);
  expect(response.error).toBeUndefined();
  return response.results.map((r) => r.filename).sort();
}

function lockIsFree(): boolean {
  return count('IndexLock') === 0;
}

describe('indexing lifecycle', () => {
  let env: TestEnvironment;
  let coordinator: IndexingCoordinator;

  beforeEach(() => {
    env = createTestEnvironment();
    coordinator = new IndexingCoordinator();
  });

  afterEach(async () => {
    await coordinator.dispose();
    env.cleanup();
  });

  describe('smoke test: one small text file', () => {
    it('indexes, searches, modifies and deletes hello.txt end to end', async () => {
      const hello = env.file('hello.txt', 'hello world\nlocal search engine\nsqlite index test\n');
      const folder = addFolder(env.root);

      const phases: IndexingPhase[] = [];
      coordinator.subscribe((state) => {
        if (phases[phases.length - 1] !== state.phase) phases.push(state.phase);
      });

      const first = await coordinator.requestFullSync('folders');
      expect(first.outcome).toBe('completed');
      expect(first.counts).toMatchObject({ discovered: 1, added: 1, indexed: 1, failed: 0 });
      expect(phases).toEqual(['starting', 'crawling', 'syncing', 'indexing', 'finalizing', 'idle']);
      expect(lockIsFree()).toBe(true);
      expect(coordinator.getState()).toMatchObject({ phase: 'idle', active: false });

      const meta = getIndexMetadata();
      expect(meta.status).toBe('indexed');
      expect(meta.last_run_status).toBe('completed');
      expect(meta.last_synced_at).not.toBeNull();
      expect(meta.total_indexed_files).toBe(1);
      expect(meta.total_indexing_runs).toBe(1);
      expect(getFolderById(folder.id)?.last_synced_at).not.toBeNull();
      expect(getIndexingRun(first.runId!)?.status).toBe('completed');

      expect(await paths('hello')).toEqual(['hello.txt']);
      expect(await paths('sqlite')).toEqual(['hello.txt']);
      expect(await paths('"local search"')).toEqual(['hello.txt']);
      expect(await paths('type:txt')).toEqual(['hello.txt']);

      // Modify: old postings replaced, new content searchable.
      fs.writeFileSync(hello, 'goodbye planet\nremote lookup service\n');
      fs.utimesSync(hello, new Date(), new Date(Date.now() + 5000));
      const second = await coordinator.requestFullSync('manual');
      expect(second.counts).toMatchObject({ modified: 1, indexed: 1 });
      expect(await paths('goodbye')).toEqual(['hello.txt']);
      expect(await paths('sqlite')).toEqual([]);
      expect(await paths('"local search"')).toEqual([]);
      expect(getDatabase().prepare("SELECT COUNT(*) AS c FROM Terms WHERE term = 'sqlite'").get()).toEqual({ c: 0 });
      expect(documentFrequencyMismatches()).toBe(0);

      // Delete: file, postings and now-unused terms disappear.
      fs.unlinkSync(hello);
      const third = await coordinator.requestFullSync('manual');
      expect(third.counts).toMatchObject({ deleted: 1 });
      expect(count('Files')).toBe(0);
      expect(count('Postings')).toBe(0);
      expect(count('Terms')).toBe(0);
      expect(await paths('goodbye')).toEqual([]);
      expect(new IntegrityManager().verify().healthy).toBe(true);
    });
  });

  describe('zero-work sessions', () => {
    it('an empty folder completes successfully and releases the lock', async () => {
      const folder = addFolder(env.root);
      const result = await coordinator.requestFullSync('folders');

      expect(result.outcome).toBe('completed');
      expect(result.counts.discovered).toBe(0);
      expect(lockIsFree()).toBe(true);
      expect(coordinator.isActive()).toBe(false);
      expect(getIndexMetadata().last_synced_at).not.toBeNull();
      expect(getFolderById(folder.id)?.last_synced_at).not.toBeNull();
      expect(getIndexMetadata().status).toBe('indexed');
    });

    it('no folders at all is a successful zero-task run', async () => {
      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('completed');
      expect(lockIsFree()).toBe(true);
      expect(getRecentIndexingRuns(1)[0].status).toBe('completed');
    });

    it('an already synchronized folder does no indexing work', async () => {
      env.file('a.txt', 'alpha');
      env.file('b.txt', 'beta');
      addFolder(env.root);
      await coordinator.requestFullSync('manual');

      let processed = 0;
      const counting = new IndexingCoordinator({
        createProcessor: (ctx) => {
          const inner = createDefaultProcessor(ctx);
          return (task, signal) => {
            processed++;
            return inner(task, signal);
          };
        },
      });
      const result = await counting.requestFullSync('startup');
      expect(result.outcome).toBe('completed');
      expect(result.counts).toMatchObject({ discovered: 2, unchanged: 2, indexed: 0 });
      expect(processed).toBe(0);
      expect(lockIsFree()).toBe(true);
    });

    it('a touched but unchanged file is not re-extracted', async () => {
      const file = env.file('a.txt', 'alpha');
      addFolder(env.root);
      await coordinator.requestFullSync('manual');
      const before = getFileByPath(file)!;

      fs.utimesSync(file, new Date(), new Date(Date.now() + 60_000));
      const result = await coordinator.requestFullSync('manual');

      expect(result.counts).toMatchObject({ unchanged: 1, indexed: 0 });
      const after = getFileByPath(file)!;
      expect(after.id).toBe(before.id);
      expect(after.modified_time).not.toBe(before.modified_time);
    });
  });

  describe('change detection', () => {
    it('indexes many files, new files, and keeps file ids stable on re-index', async () => {
      for (let i = 0; i < 40; i++) env.file(`docs/file${i}.txt`, `document number${i} shared`);
      addFolder(env.root);
      const first = await coordinator.requestFullSync('manual');
      expect(first.counts.indexed).toBe(40);
      expect(await search('shared').then((r) => r.totalCount)).toBe(40);

      const target = path.join(env.root, 'docs', 'file7.txt');
      const idBefore = getFileByPath(target)!.id;
      fs.writeFileSync(target, 'document rewritten');
      fs.utimesSync(target, new Date(), new Date(Date.now() + 5000));
      env.file('docs/new.txt', 'brand new shared');

      const second = await coordinator.requestFullSync('manual');
      expect(second.counts).toMatchObject({ added: 1, modified: 1, indexed: 2, unchanged: 39 });
      expect(getFileByPath(target)!.id).toBe(idBefore);
      expect(await search('shared').then((r) => r.totalCount)).toBe(40);
      expect(documentFrequencyMismatches()).toBe(0);
    });

    it('counts unsupported and ignored files without indexing them', async () => {
      env.file('a.txt', 'alpha');
      env.file('image.png', 'not text');
      env.file('debug.log', 'ignored by default rule');
      env.file('node_modules/pkg/readme.txt', 'ignored folder');
      env.file('.hidden/secret.txt', 'hidden');
      addFolder(env.root);

      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('completed');
      expect(result.counts.discovered).toBe(1);
      const meta = getIndexMetadata();
      expect(meta.unsupported_files_count).toBe(1);
      expect(meta.ignored_files_count).toBe(3);
      expect(count('IndexingFailures')).toBe(0);
    });

    it('skips oversized files and removes files that grew past the limit', async () => {
      const small = env.file('small.txt', 'tiny');
      env.file('big.txt', 'x'.repeat(5000));
      addFolder(env.root);
      setSetting(SETTING_KEYS.maxFileSizeBytes, '1000');

      await coordinator.requestFullSync('manual');
      expect(count('Files')).toBe(1);
      expect(getIndexMetadata().oversized_files_count).toBe(1);

      fs.writeFileSync(small, 'y'.repeat(5000));
      const result = await coordinator.requestFullSync('manual');
      expect(result.counts.deleted).toBe(1);
      expect(count('Files')).toBe(0);
    });
  });

  describe('failures', () => {
    it('a broken file is recorded, does not kill the session, and creates no Files row', async () => {
      env.file('good.txt', 'perfectly fine');
      const broken = env.file('broken.docx', 'this is not a zip archive');
      addFolder(env.root);

      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('completed_with_errors');
      expect(result.counts).toMatchObject({ indexed: 1, failed: 1 });
      expect(getFileByPath(broken)).toBeUndefined();
      expect(getIndexingFailure(broken)?.size).toBe(fs.statSync(broken).size);
      expect(getIndexMetadata().last_run_status).toBe('completed_with_errors');
      expect(getIndexMetadata().status).toBe('indexed');
      expect(lockIsFree()).toBe(true);

      // Unchanged broken file is not retried on every sync.
      const again = await coordinator.requestFullSync('manual');
      expect(again.counts.failed).toBe(0);
      expect(again.counts.skipped).toBeGreaterThanOrEqual(1);
    });

    it('failed re-extraction keeps the previous valid index entry', async () => {
      const doc = path.join(env.root, 'doc.docx');
      createDocx(doc, 'original quarterly content');
      addFolder(env.root);
      await coordinator.requestFullSync('manual');
      expect(await paths('quarterly')).toEqual(['doc.docx']);

      fs.writeFileSync(doc, 'corrupted now');
      fs.utimesSync(doc, new Date(), new Date(Date.now() + 5000));
      const result = await coordinator.requestFullSync('manual');

      expect(result.outcome).toBe('completed_with_errors');
      expect(getIndexingFailure(doc)).toBeDefined();
      expect(await paths('quarterly')).toEqual(['doc.docx']);
    });

    it('an unreadable folder root keeps its indexed files instead of deleting them', async () => {
      const sub = path.join(env.root, 'drive');
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, 'a.txt'), 'external drive content');
      addFolder(sub);
      await coordinator.requestFullSync('manual');
      expect(count('Files')).toBe(1);

      fs.rmSync(sub, { recursive: true }); // "unplugged"
      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('completed_with_errors');
      expect(count('Files')).toBe(1);
    });

    it('a session that throws is recorded as failed and fully cleaned up', async () => {
      const failing = new IndexingCoordinator({
        syncManager: {
          sync: async () => {
            throw new Error('disk exploded');
          },
        } as unknown as SyncManager,
      });

      const result = await failing.requestFullSync('manual');
      expect(result.outcome).toBe('failed');
      expect(result.error).toBe('disk exploded');
      expect(getIndexingRun(result.runId!)?.status).toBe('failed');
      expect(getIndexMetadata()).toMatchObject({ status: 'error', error_message: 'disk exploded' });
      expect(getIndexMetadata().last_synced_at).toBeNull();
      expect(lockIsFree()).toBe(true);
      expect(failing.getState().phase).toBe('idle');

      // Recoverable: the next session works and clears the error.
      env.file('a.txt', 'alpha');
      addFolder(env.root);
      const next = await coordinator.requestFullSync('manual');
      expect(next.outcome).toBe('completed');
      expect(getIndexMetadata()).toMatchObject({ status: 'indexed', error_message: null });
    });

    it('repeated database errors abort the session as failed', async () => {
      env.file('a.txt', 'a');
      env.file('b.txt', 'b');
      env.file('c.txt', 'c');
      env.file('d.txt', 'd');
      env.file('e.txt', 'e');
      addFolder(env.root);
      const broken = new IndexingCoordinator({
        createProcessor: () => async () => ({
          status: 'failed',
          category: 'database_error',
          message: 'SQLITE_FULL',
        }),
      });
      const result = await broken.requestFullSync('manual');
      expect(result.outcome).toBe('failed');
      expect(result.error).toMatch(/consecutive database errors/);
      expect(lockIsFree()).toBe(true);
    });

    it('fails cleanly if another process holds the lock, without stealing it', async () => {
      new LockManager().acquire('other-process');
      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('failed');
      expect(result.error).toMatch(/locked/);
      expect(new LockManager().getLock()?.owner).toBe('other-process');
    });
  });

  describe('cancellation', () => {
    function gatedCoordinator(gate: Promise<void>, started: () => void): IndexingCoordinator {
      return new IndexingCoordinator({
        createProcessor: (ctx) => {
          const inner = createDefaultProcessor(ctx);
          const processor: TaskProcessor = async (task, signal) => {
            started();
            await gate;
            return inner(task, signal);
          };
          return processor;
        },
      });
    }

    it('cancelling during active work commits nothing after the cancel and cleans up', async () => {
      for (let i = 0; i < 5; i++) env.file(`f${i}.txt`, `content ${i}`);
      const folder = addFolder(env.root);
      const gate = deferred();
      const firstTaskStarted = deferred();
      const gated = gatedCoordinator(gate.promise, () => firstTaskStarted.resolve());

      const session = gated.requestFullSync('manual');
      await firstTaskStarted.promise; // a task is in flight
      const cancelling = gated.cancel();
      expect(gated.getState().phase).toBe('cancelling');
      gate.resolve(); // the in-flight task resumes after cancellation

      const result = await cancelling;
      expect(await session).toBe(result);
      expect(result?.outcome).toBe('cancelled');
      expect(count('Files')).toBe(0); // in-flight task did not commit
      expect(getIndexingRun(result!.runId!)?.status).toBe('cancelled');
      expect(getIndexMetadata().last_synced_at).toBeNull();
      expect(getIndexMetadata().last_run_status).toBe('cancelled');
      expect(getFolderById(folder.id)?.last_synced_at).toBeNull();
      expect(lockIsFree()).toBe(true);
      expect(gated.getState()).toMatchObject({ phase: 'idle', active: false });
    });

    it('cancelling with queued work keeps already committed files and stops the rest', async () => {
      for (let i = 0; i < 20; i++) env.file(`f${i}.txt`, `content ${i}`);
      addFolder(env.root);
      let processed = 0;
      const stopAfterThree = new IndexingCoordinator({
        createProcessor: (ctx) => {
          const inner = createDefaultProcessor(ctx);
          return async (task, signal) => {
            const outcome = await inner(task, signal);
            if (++processed === 3) void stopAfterThree.cancel();
            return outcome;
          };
        },
      });

      const result = await stopAfterThree.requestFullSync('manual');
      expect(result.outcome).toBe('cancelled');
      expect(count('Files')).toBe(3);
      expect(result.counts.indexed).toBe(3);
      expect(getIndexMetadata().total_indexed_files).toBe(3);
      expect(documentFrequencyMismatches()).toBe(0);
      expect(lockIsFree()).toBe(true);

      // The next sync picks up where it left off.
      const next = await coordinator.requestFullSync('manual');
      expect(next.counts).toMatchObject({ added: 17, unchanged: 3 });
    });

    it('cancel with no session is a no-op', async () => {
      expect(await coordinator.cancel()).toBeNull();
    });
  });

  describe('concurrency and follow-up work', () => {
    it('concurrent start requests join the running session', async () => {
      env.file('a.txt', 'alpha');
      addFolder(env.root);
      const a = coordinator.requestFullSync('manual');
      const b = coordinator.requestFullSync('manual');
      expect(b).toBe(a);
      await a;
      expect(getRecentIndexingRuns(10)).toHaveLength(1);
      expect(lockIsFree()).toBe(true);
    });

    it('a configuration change during a session schedules one more full sync', async () => {
      env.file('a.txt', 'alpha');
      addFolder(env.root);
      const first = coordinator.requestFullSync('manual');

      const second = path.join(env.root, '..', path.basename(env.root) + '-second');
      fs.mkdirSync(second);
      fs.writeFileSync(path.join(second, 'b.txt'), 'beta');
      addFolder(second);
      const followUp = coordinator.requestFullSync('folders', { afterCurrent: true });
      const followUpAgain = coordinator.requestFullSync('folders', { afterCurrent: true });

      await first;
      const result = await followUp;
      expect(await followUpAgain).toBe(result);
      expect(result.sessionId).not.toBe((await first).sessionId);
      expect(await paths('beta')).toEqual(['b.txt']);
      expect(getRecentIndexingRuns(10)).toHaveLength(2);
      fs.rmSync(second, { recursive: true, force: true });
    });

    it('watcher changes that arrive during a sync are processed after it', async () => {
      env.file('a.txt', 'alpha');
      addFolder(env.root);
      const gate = deferred();
      const started = deferred();
      const gated = new IndexingCoordinator({
        createProcessor: (ctx) => {
          const inner = createDefaultProcessor(ctx);
          return async (task, signal) => {
            started.resolve();
            await gate.promise;
            return inner(task, signal);
          };
        },
      });

      const session = gated.requestFullSync('manual');
      await started.promise;
      const late = env.file('late.txt', 'arrived during sync');
      expect(gated.requestIncremental([{ type: 'index', path: late }])).toBeNull();
      gate.resolve();
      await session;

      // The buffered change runs as its own incremental session.
      await new Promise<void>((resolve) => {
        const check = () => (gated.isActive() ? setTimeout(check, 5) : resolve());
        check();
      });
      expect(gated.getState().lastResult?.kind).toBe('incremental');
      expect(await paths('arrived')).toEqual(['late.txt']);
      expect(lockIsFree()).toBe(true);
    });
  });

  describe('folders, duplicates and configuration', () => {
    it('handles multiple folders and removes files of a removed folder', async () => {
      const one = path.join(env.root, 'one');
      const two = path.join(env.root, 'two');
      fs.mkdirSync(one);
      fs.mkdirSync(two);
      fs.writeFileSync(path.join(one, 'a.txt'), 'shared alpha');
      fs.writeFileSync(path.join(two, 'b.txt'), 'shared beta');
      addFolder(one);
      const second = addFolder(two);

      await coordinator.requestFullSync('manual');
      expect(await paths('shared')).toEqual(['a.txt', 'b.txt']);

      removeFolder(second.id);
      const result = await coordinator.requestFullSync('folders');
      expect(result.counts.deleted).toBe(1);
      expect(await paths('shared')).toEqual(['a.txt']);
      expect(new IntegrityManager().verify().healthy).toBe(true);
    });

    it('recognizes duplicate content without removing either file', async () => {
      env.file('one.txt', 'identical content here');
      env.file('copy/two.txt', 'identical content here');
      env.file('other.txt', 'different');
      addFolder(env.root);
      await coordinator.requestFullSync('manual');

      const groups = findDuplicateGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].files.map((f) => path.basename(f.path)).sort()).toEqual(['one.txt', 'two.txt']);
      expect(await search('identical').then((r) => r.totalCount)).toBe(2);

      fs.unlinkSync(path.join(env.root, 'one.txt'));
      await coordinator.requestFullSync('manual');
      expect(findDuplicateGroups()).toHaveLength(0);
      expect(await paths('identical')).toEqual(['two.txt']);
    });

    it('changing a content-affecting setting re-indexes every file on the next sync', async () => {
      env.file('a.txt', 'alpha');
      env.file('b.txt', 'beta');
      addFolder(env.root);
      await coordinator.requestFullSync('manual');

      setBooleanSetting(SETTING_KEYS.removeStopWords, true);
      const result = await coordinator.requestFullSync('settings');
      expect(result.counts.indexed).toBe(2);

      // Once completed, the configuration is current again.
      const again = await coordinator.requestFullSync('manual');
      expect(again.counts.indexed).toBe(0);
    });

    it('indexes PDF and DOCX files', async () => {
      createPdf(path.join(env.root, 'report.pdf'), 'Quarterly database report');
      createDocx(path.join(env.root, 'guide.docx'), 'SQLite guide for local search');
      addFolder(env.root);
      const result = await coordinator.requestFullSync('manual');
      expect(result.outcome).toBe('completed');
      expect(await paths('quarterly')).toEqual(['report.pdf']);
      expect(await paths('guide')).toEqual(['guide.docx']);
    });
  });
});
