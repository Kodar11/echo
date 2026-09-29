import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { addFolder, type FolderRecord } from '../database/folders.js';
import { setBooleanSetting } from '../database/settings.js';
import { IndexingCoordinator } from '../indexer/IndexingCoordinator.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { createDocx, createPdf, createTestEnvironment, type TestEnvironment } from '../test/fixtures.js';
import { searchEngine } from './engine.js';

const ENGLISH =
  'Echo is a local search engine for desktop computers. It stores the inverted index in an SQLite database, ' +
  'and the database is updated whenever documents change. Researchers use it for their studies every day.';

async function names(query: string, folderIds?: number[]): Promise<string[]> {
  const response = await searchEngine.search({ query, folderIds });
  expect(response.error, `unexpected error for ${query}: ${response.error?.message}`).toBeUndefined();
  return response.results.map((r) => r.filename).sort();
}

describe('search over an indexed corpus', () => {
  let env: TestEnvironment;
  let barFolder: FolderRecord;
  const ALL = [
    'big.txt',
    'db.txt',
    'guide.docx',
    'manual.docx',
    'notes.md',
    'old.txt',
    'other.txt',
    'recipes.txt',
    'report.pdf',
    'scoped.txt',
    'unicode.txt',
  ];

  beforeAll(async () => {
    env = createTestEnvironment();
    env.file('db.txt', ENGLISH);
    env.file('notes.md', '# Notes\nPlanning the local roadmap and search features.');
    createPdf(path.join(env.root, 'report.pdf'), 'Quarterly database report');
    createDocx(path.join(env.root, 'guide.docx'), 'SQLite guide for local search');
    createDocx(path.join(env.root, 'manual.docx'), 'Installation manual');
    env.file('recipes.txt', 'Cooking recipes with pasta and tomatoes. Buffalo buffalo buffalo.');
    env.file('unicode.txt', 'Café crème brûlée in Zürich. नमस्ते दुनिया');
    env.file('old.txt', 'archived legacy notes', new Date(2020, 5, 15, 12));
    env.file('big.txt', 'padding '.repeat(2000) + 'bigword');
    env.file('bar/scoped.txt', 'scopeword inside bar');
    env.file('bar2/other.txt', 'scopeword inside bar2');

    addFolder(env.root);
    barFolder = addFolder(path.join(env.root, 'bar'));
    const result = await new IndexingCoordinator().requestFullSync('manual');
    expect(result.outcome).toBe('completed');
  });

  afterAll(() => env.cleanup());

  describe('boolean queries', () => {
    it('A. exact term', async () => {
      expect(await names('sqlite')).toEqual(['db.txt', 'guide.docx']);
    });

    it('B. AND requires every operand (explicit and implicit)', async () => {
      expect(await names('database AND sqlite')).toEqual(['db.txt']);
      expect(await names('database sqlite')).toEqual(['db.txt']);
      expect(await names('sqlite AND search')).toEqual(['db.txt', 'guide.docx']);
    });

    it('C. OR', async () => {
      expect(await names('sqlite OR quarterly')).toEqual(['db.txt', 'guide.docx', 'report.pdf']);
    });

    it('D. NOT evaluates against every file in scope', async () => {
      expect(await names('NOT sqlite')).toEqual(ALL.filter((n) => n !== 'db.txt' && n !== 'guide.docx'));
      expect(await names('database NOT sqlite')).toEqual(['report.pdf']);
    });

    it('E. parentheses', async () => {
      expect(await names('(sqlite OR quarterly) AND database')).toEqual(['db.txt', 'report.pdf']);
    });
  });

  describe('phrases', () => {
    it('F. phrase-only query', async () => {
      expect(await names('"local search"')).toEqual(['db.txt', 'guide.docx']);
    });

    it('phrase combined with terms and order sensitivity', async () => {
      expect(await names('"local search" AND sqlite')).toEqual(['db.txt', 'guide.docx']);
      expect(await names('"search local"')).toEqual([]);
    });

    it('punctuation and hyphenated words act as phrases', async () => {
      expect(await names('"search, engine"')).toEqual(['db.txt']);
      expect(await names('search-engine')).toEqual(['db.txt']);
    });

    it('repeated words and multiple occurrences', async () => {
      const response = await searchEngine.search({ query: '"buffalo buffalo"' });
      expect(response.results.map((r) => r.filename)).toEqual(['recipes.txt']);
      expect(response.results[0].phraseMatch).toBe(true);
    });

    it('a quoted single word is exact (no prefix expansion)', async () => {
      expect(await names('"data"')).toEqual([]);
      expect(await names('data')).toEqual(['db.txt', 'report.pdf']);
    });
  });

  describe('filters', () => {
    it('G. filter-only query', async () => {
      expect(await names('type:pdf')).toEqual(['report.pdf']);
      expect(await names('ext:.docx')).toEqual(['guide.docx', 'manual.docx']);
    });

    it('H. filter + term', async () => {
      expect(await names('type:pdf AND database')).toEqual(['report.pdf']);
      expect(await names('type:pdf sqlite')).toEqual([]);
    });

    it('I. filter OR filter', async () => {
      expect(await names('type:pdf OR type:docx')).toEqual(['guide.docx', 'manual.docx', 'report.pdf']);
    });

    it('J. NOT filter', async () => {
      expect(await names('NOT type:pdf')).toEqual(ALL.filter((n) => n !== 'report.pdf'));
    });

    it('K. date filters use local calendar days', async () => {
      expect(await names('modified:2020-06-15')).toEqual(['old.txt']);
      expect(await names('modified<2021-01-01')).toEqual(['old.txt']);
      expect(await names('before:2021')).toEqual(['old.txt']);
      expect(await names('after:2020-06-15')).toEqual(ALL.filter((n) => n !== 'old.txt'));
      expect(await names('modified:2020-06')).toEqual(['old.txt']);
      expect(await names('modified:today')).toEqual(ALL.filter((n) => n !== 'old.txt'));
    });

    it('L. size filters', async () => {
      expect(await names('size>10KB')).toEqual(['big.txt']);
      expect(await names('size<=10KB type:pdf')).toEqual(['report.pdf']);
    });

    it('M. folder scope respects path boundaries (bar vs bar2)', async () => {
      expect(await names('scopeword')).toEqual(['other.txt', 'scoped.txt']);
      expect(await names('scopeword', [barFolder.id])).toEqual(['scoped.txt']);
      expect(await names('NOT sqlite', [barFolder.id])).toEqual(['scoped.txt']);
    });
  });

  describe('errors', () => {
    it.each([
      ['foo:bar', /Unknown filter "foo"/],
      ['size>abc', /Invalid size/],
      ['modified:notadate', /Invalid date/],
      ['modified:2021-02-30', /Invalid date/],
      ['type:p*f', /Invalid file type/],
      ['language:klingon', /Unknown language/],
      ['author>bob', /does not support/],
      ['sqlite AND http://example.com', /Unknown filter "http"/],
    ])('N. invalid filter %s returns a filter error, not results', async (query, message) => {
      const response = await searchEngine.search({ query });
      expect(response.error?.kind).toBe('filter');
      expect(response.error?.message).toMatch(message);
      expect(response.results).toEqual([]);
    });

    it.each([
      ['"unclosed phrase', /Unclosed quote/],
      ['(sqlite OR database', /Missing closing parenthesis/],
      ['sqlite)', /Unmatched closing parenthesis/],
      ['AND sqlite', /Missing search term before AND/],
      ['sqlite AND', /ends with an operator/],
      ['sqlite OR OR database', /Missing search term before OR/],
      ['()', /Empty parentheses/],
      ['type:', /needs a value/],
      ['NOT', /ends with an operator/],
    ])('O. invalid syntax %s returns a syntax error', async (query, message) => {
      const response = await searchEngine.search({ query });
      expect(response.error?.kind).toBe('syntax');
      expect(response.error?.message).toMatch(message);
      expect(response.results).toEqual([]);
    });

    it('P. empty query returns nothing and no error', async () => {
      for (const query of ['', '   ', '!!!']) {
        const response = await searchEngine.search({ query });
        expect(response).toMatchObject({ results: [], totalCount: 0 });
        expect(response.error).toBeUndefined();
      }
    });
  });

  describe('text handling', () => {
    it('T. Unicode: composed/decomposed, case and diacritics normalize the same way', async () => {
      expect(await names('café')).toEqual(['unicode.txt']);
      expect(await names('CAFÉ')).toEqual(['unicode.txt']);
      expect(await names('zurich')).toEqual(['unicode.txt']);
      expect(await names('BRÛLÉE')).toEqual(['unicode.txt']);
      expect(await names('नमस्ते')).toEqual(['unicode.txt']);
      expect(await names('"नमस्ते दुनिया"')).toEqual(['unicode.txt']);
    });

    it('W. fuzzy matching only kicks in when nothing matches exactly', async () => {
      expect(await names('databse')).toEqual(['db.txt', 'report.pdf']);
      // "notes" exists exactly: no fuzzy expansion to "nodes"/"note".
      const response = await searchEngine.search({ query: 'notes' });
      expect(response.results.map((r) => r.filename).sort()).toEqual(['notes.md', 'old.txt']);
    });
  });

  describe('results', () => {
    it('returns real, ordered ranking scores', async () => {
      const response = await searchEngine.search({ query: 'database' });
      expect(response.results.length).toBe(2);
      for (const result of response.results) expect(result.score).toBeGreaterThan(0);
      const scores = response.results.map((r) => r.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    });

    it('filter-only results are ordered deterministically', async () => {
      const a = await searchEngine.search({ query: 'type:docx' });
      const b = await searchEngine.search({ query: 'type:docx' });
      expect(a.results.map((r) => r.path)).toEqual(b.results.map((r) => r.path));
    });

    it('builds snippets around the match', async () => {
      const response = await searchEngine.search({ query: 'inverted' });
      expect(response.results[0].snippets[0]).toMatch(/inverted/i);
    });

    it('R. a file deleted from disk but still indexed does not break the result list', async () => {
      const gone = env.file('gone.txt', 'vanishing content');
      await new IndexingCoordinator().requestFullSync('manual');
      fs.unlinkSync(gone);
      const response = await searchEngine.search({ query: 'vanishing' });
      expect(response.results.map((r) => r.filename)).toEqual(['gone.txt']);
      expect(response.results[0].snippets).toEqual([]);
      await new IndexingCoordinator().requestFullSync('manual');
      expect(await names('vanishing')).toEqual([]);
    });

    it('X. a superseded search reports cancelled instead of stale results', async () => {
      let calls = 0;
      const response = await searchEngine.search({ query: 'database', requestId: 7 }, () => ++calls > 1);
      expect(response).toMatchObject({ cancelled: true, results: [], requestId: 7 });
    });
  });
});

describe('language-aware indexing', () => {
  let env: TestEnvironment;

  afterAll(() => env?.cleanup());

  it('U/V. stop words are removed but phrases keep original positions', async () => {
    env = createTestEnvironment();
    setBooleanSetting(SETTING_KEYS.removeStopWords, true);
    env.file(
      'ml.txt',
      'In this report we describe the machine learning model that was trained on the data. ' +
        'The machine learning pipeline is evaluated with several metrics and the results are discussed.'
    );
    addFolder(env.root);
    await new IndexingCoordinator().requestFullSync('manual');

    // "the" was not indexed for this English document.
    expect(await names('the')).toEqual([]);
    expect(await names('machine')).toEqual(['ml.txt']);
    expect(await names('"machine learning"')).toEqual(['ml.txt']);
    expect(await names('"the machine learning"')).toEqual(['ml.txt']);
    expect(await names('"learning machine"')).toEqual([]);
    // The stop word is a wildcard at its own offset, not an ignorable gap.
    expect(await names('"machine the learning"')).toEqual([]);
    expect(await names('"trained on data"')).toEqual([]);
    expect(await names('"trained on the data"')).toEqual(['ml.txt']);

    setBooleanSetting(SETTING_KEYS.removeStopWords, false);
    env.cleanup();
    env = undefined as unknown as TestEnvironment;
  });

  it('stemming expands only with vocabulary from documents of that language', async () => {
    env = createTestEnvironment();
    setBooleanSetting(SETTING_KEYS.enableStemming, true);
    env.file('english.txt', ENGLISH);
    // Undetected language (not English): its words must not be stem-expanded.
    env.file('other.txt', 'studies');
    addFolder(env.root);
    await new IndexingCoordinator().requestFullSync('manual');

    expect(await names('studying')).toEqual(['english.txt']);
    expect(await names('studies')).toEqual(['english.txt', 'other.txt']);

    setBooleanSetting(SETTING_KEYS.enableStemming, false);
    searchEngine.rebuildIndex();
    expect(await names('studying')).toEqual([]);
  });
});
