import { describe, expect, it } from 'vitest';
import { parseQuery } from './queryParser.js';

describe('parseQuery', () => {
  it('returns null root for empty query', () => {
    const result = parseQuery('');
    expect(result.root).toBeNull();
    expect(result.hasFilters).toBe(false);
  });

  it('parses a single term', () => {
    const result = parseQuery('database');
    expect(result.root).toEqual({ type: 'term', value: 'database' });
  });

  it('parses an exact phrase', () => {
    const result = parseQuery('"database replication"');
    expect(result.root).toEqual({
      type: 'phrase',
      value: 'database replication',
      terms: ['database', 'replication'],
    });
  });

  it('implicit AND between terms', () => {
    const result = parseQuery('database cache');
    expect(result.root).toEqual({
      type: 'and',
      left: { type: 'term', value: 'database' },
      right: { type: 'term', value: 'cache' },
    });
  });

  it('explicit AND', () => {
    const result = parseQuery('database AND cache');
    expect(result.root).toEqual({
      type: 'and',
      left: { type: 'term', value: 'database' },
      right: { type: 'term', value: 'cache' },
    });
  });

  it('OR operator', () => {
    const result = parseQuery('database OR cache');
    expect(result.root).toEqual({
      type: 'or',
      left: { type: 'term', value: 'database' },
      right: { type: 'term', value: 'cache' },
    });
  });

  it('NOT operator', () => {
    const result = parseQuery('database NOT mysql');
    expect(result.root).toEqual({
      type: 'and',
      left: { type: 'term', value: 'database' },
      right: { type: 'not', child: { type: 'term', value: 'mysql' } },
    });
  });

  it('grouping with precedence', () => {
    const result = parseQuery('(database OR redis) AND cache');
    expect(result.root).toEqual({
      type: 'and',
      left: {
        type: 'or',
        left: { type: 'term', value: 'database' },
        right: { type: 'term', value: 'redis' },
      },
      right: { type: 'term', value: 'cache' },
    });
  });

  it('parses type filter', () => {
    const result = parseQuery('type:pdf');
    expect(result.root).toEqual({
      type: 'filter',
      key: 'type',
      operator: ':',
      value: 'pdf',
    });
    expect(result.hasFilters).toBe(true);
  });

  it('parses size filter', () => {
    const result = parseQuery('size>10MB');
    expect(result.root).toEqual({
      type: 'filter',
      key: 'size',
      operator: '>',
      value: '10MB',
    });
  });

  it('parses folder filter with quoted value', () => {
    const result = parseQuery('folder:"system design"');
    expect(result.root).toEqual({
      type: 'filter',
      key: 'folder',
      operator: ':',
      value: 'system design',
    });
  });

  it('combines filters with terms', () => {
    const result = parseQuery('type:pdf database');
    expect(result.root).toEqual({
      type: 'and',
      left: { type: 'filter', key: 'type', operator: ':', value: 'pdf' },
      right: { type: 'term', value: 'database' },
    });
  });

  it('operator precedence: AND before OR', () => {
    const result = parseQuery('a OR b AND c');
    expect(result.root).toEqual({
      type: 'or',
      left: { type: 'term', value: 'a' },
      right: {
        type: 'and',
        left: { type: 'term', value: 'b' },
        right: { type: 'term', value: 'c' },
      },
    });
  });
});
