import { describe, expect, it } from 'vitest';
import { IndexQueue, QueueFatalError, type IndexTask, type TaskProcessor } from './IndexQueue.js';
import type { TaskOutcome } from './singleFileIndexer.js';

function recorder(outcome: (task: IndexTask) => TaskOutcome = () => ({ status: 'indexed' })) {
  const seen: IndexTask[] = [];
  const processor: TaskProcessor = async (task) => {
    seen.push(task);
    return outcome(task);
  };
  return { seen, processor };
}

describe('IndexQueue', () => {
  it('resolves immediately with zero tasks', async () => {
    const queue = new IndexQueue(recorder().processor);
    const result = await queue.run();
    expect(result).toMatchObject({ status: 'completed', total: 0, processed: 0 });
    expect(queue.getProgress().pendingTasks).toBe(0);
  });

  it('coalesces tasks for the same path (latest wins)', async () => {
    const { seen, processor } = recorder();
    const queue = new IndexQueue(processor);
    queue.enqueueMany([
      { type: 'index', path: '/a' },
      { type: 'index', path: '/b' },
      { type: 'delete', path: '/a' },
    ]);
    const result = await queue.run();
    expect(seen).toEqual([
      { type: 'index', path: '/b' },
      { type: 'delete', path: '/a' },
    ]);
    expect(result.total).toBe(2);
  });

  it('distinguishes indexed, unchanged, deleted, skipped and failed', async () => {
    const outcomes: Record<string, TaskOutcome> = {
      '/i': { status: 'indexed', change: 'added' },
      '/m': { status: 'indexed', change: 'modified' },
      '/u': { status: 'unchanged' },
      '/d': { status: 'deleted' },
      '/s': { status: 'skipped', reason: 'unsupported' },
      '/f': { status: 'failed', category: 'corrupted', message: 'bad' },
    };
    const queue = new IndexQueue(recorder((t) => outcomes[t.path]).processor);
    queue.enqueueMany(Object.keys(outcomes).map((p) => ({ type: 'index' as const, path: p })));
    const result = await queue.run();
    expect(result).toMatchObject({
      status: 'completed_with_errors',
      processed: 6,
      indexed: 2,
      added: 1,
      modified: 1,
      unchanged: 1,
      deleted: 1,
      skipped: 1,
      failed: 1,
    });
  });

  it('a processor that throws counts as a failure, not a crash', async () => {
    const queue = new IndexQueue(async () => {
      throw new Error('boom');
    });
    queue.enqueue({ type: 'index', path: '/a' });
    const result = await queue.run();
    expect(result).toMatchObject({ status: 'completed_with_errors', failed: 1 });
  });

  it('stops before the next task when aborted and reports the rest as cancelled', async () => {
    const controller = new AbortController();
    const queue = new IndexQueue(async (task) => {
      if (task.path === '/2') controller.abort();
      return { status: 'indexed' };
    });
    queue.enqueueMany(['/1', '/2', '/3', '/4'].map((p) => ({ type: 'index' as const, path: p })));
    const result = await queue.run(controller.signal);
    expect(result).toMatchObject({ status: 'cancelled', processed: 2, cancelled: 2 });
  });

  it('an in-flight task that observed cancellation is not counted as processed', async () => {
    const controller = new AbortController();
    const queue = new IndexQueue(async () => {
      controller.abort();
      return { status: 'cancelled' };
    });
    queue.enqueueMany([{ type: 'index', path: '/1' }, { type: 'index', path: '/2' }]);
    const result = await queue.run(controller.signal);
    expect(result).toMatchObject({ status: 'cancelled', processed: 0, cancelled: 2 });
  });

  it('aborts with a fatal error after repeated database errors', async () => {
    const queue = new IndexQueue(async () => ({ status: 'failed', category: 'database_error', message: 'x' }));
    queue.enqueueMany(['/1', '/2', '/3', '/4', '/5', '/6'].map((p) => ({ type: 'index' as const, path: p })));
    await expect(queue.run()).rejects.toBeInstanceOf(QueueFatalError);
    expect(queue.getProgress().status).toBe('failed');
  });
});
