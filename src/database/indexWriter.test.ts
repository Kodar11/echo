import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../test/testDb.js';
import { count, documentFrequencyMismatches } from '../test/fixtures.js';
import { CancelledError } from '../indexer/cancellation.js';
import { getDatabase } from './connection.js';
import { getFileByPath } from './files.js';
import { removeFileFromIndex, writeFileIndex, type FileIndexData } from './indexWriter.js';

function data(path: string, terms: Record<string, number[]>): FileIndexData {
  return {
    path,
    size: 1,
    modifiedTime: 1000.75,
    docLength: 3,
    language: null,
    contentHash: 'h',
    author: null,
    createdAt: null,
    extension: '.txt',
    positions: new Map(Object.entries(terms)),
  };
}

describe('indexWriter', () => {
  let dbInfo: { dbPath: string };

  beforeEach(() => {
    dbInfo = setupTestDatabase();
  });

  afterEach(() => teardownTestDatabase(dbInfo.dbPath));

  it('stores integer millisecond mtimes', () => {
    writeFileIndex(data('/a', { x: [0] }));
    expect(getFileByPath('/a')?.modified_time).toBe(1000);
  });

  it('keeps document frequency exact and deletes unused terms', () => {
    writeFileIndex(data('/a', { shared: [0], onlya: [1] }));
    writeFileIndex(data('/b', { shared: [0] }));
    expect(getDatabase().prepare("SELECT document_frequency AS df FROM Terms WHERE term='shared'").get()).toEqual({ df: 2 });

    writeFileIndex(data('/a', { other: [0] }));
    expect(documentFrequencyMismatches()).toBe(0);
    expect(getDatabase().prepare("SELECT COUNT(*) AS c FROM Terms WHERE term='onlya'").get()).toEqual({ c: 0 });

    removeFileFromIndex('/b');
    removeFileFromIndex('/a');
    expect(count('Terms')).toBe(0);
    expect(count('Postings')).toBe(0);
  });

  it('never commits when cancellation was observed', () => {
    writeFileIndex(data('/a', { before: [0] }));
    const controller = new AbortController();
    controller.abort();

    expect(() => writeFileIndex(data('/a', { after: [0] }), controller.signal)).toThrow(CancelledError);
    expect(() => removeFileFromIndex('/a', controller.signal)).toThrow(CancelledError);

    const terms = getDatabase().prepare('SELECT term FROM Terms').all();
    expect(terms).toEqual([{ term: 'before' }]);
  });

  it('rolls back the whole file when a write fails midway', () => {
    writeFileIndex(data('/a', { old: [0] }));
    // An invalid posting (term_frequency must be > 0) fails the transaction.
    const bad = data('/a', { good: [0], broken: [] });
    expect(() => writeFileIndex(bad)).toThrow();

    const terms = getDatabase().prepare('SELECT term FROM Terms ORDER BY term').all();
    expect(terms).toEqual([{ term: 'old' }]);
    expect(count('Postings')).toBe(1);
    expect(documentFrequencyMismatches()).toBe(0);
  });
});
