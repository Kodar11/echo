import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../database/files.js';
import type { FilterNode } from './queryParser.js';
import { compileFilter, evaluateFilter, FilterError } from './filters.js';

function makeFile(partial: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 1,
    path: 'C:\\test\\doc.pdf',
    size: 1024,
    modified_time: Date.now(),
    doc_length: 10,
    indexed_at: Date.now(),
    language: null,
    content_hash: null,
    author: null,
    created_at: null,
    extension: '.pdf',
    ...partial,
  };
}

function filter(
  key: string,
  operator: string,
  value: string
): FilterNode {
  return { type: 'filter', key, operator, value };
}

describe('evaluateFilter', () => {
  it('matches extension', () => {
    const file = makeFile({ path: 'C:\\test\\doc.pdf', extension: '.pdf' });
    expect(evaluateFilter(file, filter('extension', ':', 'pdf'))).toBe(true);
    expect(evaluateFilter(file, filter('extension', ':', 'txt'))).toBe(false);
  });

  it('matches type alias', () => {
    const file = makeFile({ path: 'C:\\test\\doc.pdf' });
    expect(evaluateFilter(file, filter('type', ':', 'pdf'))).toBe(true);
  });

  it('matches author substring', () => {
    const file = makeFile({ author: 'Tanmay Chavan' });
    expect(evaluateFilter(file, filter('author', ':', 'Tanmay'))).toBe(true);
    expect(evaluateFilter(file, filter('author', ':', 'nobody'))).toBe(false);
  });

  it('matches language', () => {
    const file = makeFile({ language: 'eng' });
    expect(evaluateFilter(file, filter('language', ':', 'eng'))).toBe(true);
    expect(evaluateFilter(file, filter('language', ':', 'hin'))).toBe(false);
  });

  it('matches relative today date', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const file = makeFile({ modified_time: today.getTime() + 1000 });
    expect(evaluateFilter(file, filter('modified', ':', 'today'))).toBe(true);
  });

  it('matches relative last7days date', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const file = makeFile({ created_at: threeDaysAgo.getTime() });
    expect(evaluateFilter(file, filter('created', ':', 'last7days'))).toBe(
      true
    );
  });

  it('uses day ranges for comparisons on dates', () => {
    const file = makeFile({ modified_time: new Date(2024, 0, 1, 15, 0).getTime() });
    expect(evaluateFilter(file, filter('modified', ':', '2024-01-01'))).toBe(true);
    expect(evaluateFilter(file, filter('modified', '>', '2024-01-01'))).toBe(false);
    expect(evaluateFilter(file, filter('modified', '>=', '2024-01-01'))).toBe(true);
    expect(evaluateFilter(file, filter('modified', '<=', '2024-01-01'))).toBe(true);
    expect(evaluateFilter(file, filter('modified', '<', '2024-01-01'))).toBe(false);
    expect(evaluateFilter(file, filter('before', ':', '2024-01-02'))).toBe(true);
    expect(evaluateFilter(file, filter('after', ':', '2023-12-31'))).toBe(true);
  });

  it.each([
    ['nosuchkey', ':', 'x', /Unknown filter/],
    ['type', ':', 'p d f', /Invalid file type/],
    ['type', '>', 'pdf', /does not support/],
    ['size', '>', 'huge', /Invalid size/],
    ['modified', ':', '1', /Invalid date/],
    ['modified', ':', '2024-13-01', /Invalid date/],
    ['created', '<', 'yesterdayish', /Invalid date/],
    ['language', ':', 'xx', /Unknown language/],
  ])('rejects invalid filter %s%s%s instead of matching everything', (key, op, value, message) => {
    expect(() => compileFilter(filter(key, op, value))).toThrow(FilterError);
    expect(() => compileFilter(filter(key, op, value))).toThrow(message);
  });

  it('accepts language names and aliases', () => {
    const file = makeFile({ language: 'eng' });
    expect(evaluateFilter(file, filter('lang', ':', 'English'))).toBe(true);
  });

  it('folder filter ignores separator style', () => {
    const file = makeFile({ path: 'C:\\work\\system design\\doc.pdf' });
    expect(evaluateFilter(file, filter('folder', ':', 'work/system design'))).toBe(true);
  });

  it('matches size comparisons', () => {
    const file = makeFile({ size: 1024 * 1024 });
    expect(evaluateFilter(file, filter('size', '>', '500KB'))).toBe(true);
    expect(evaluateFilter(file, filter('size', '<', '500KB'))).toBe(false);
  });
});
