import { describe, expect, it } from 'vitest';
import { Trie } from './trie.js';

describe('Trie', () => {
  it('inserts and finds terms by prefix', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('catalog');
    trie.insert('dog');

    expect(trie.find('cat').sort()).toEqual(['cat', 'catalog']);
    expect(trie.find('do').sort()).toEqual(['dog']);
    expect(trie.find('zebra')).toEqual([]);
  });

  it('checks term existence', () => {
    const trie = new Trie();
    trie.insert('test');
    expect(trie.has('test')).toBe(true);
    expect(trie.has('tes')).toBe(false);
  });

  it('removes terms', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('catalog');
    trie.remove('cat');
    expect(trie.has('cat')).toBe(false);
    expect(trie.has('catalog')).toBe(true);
  });
});
