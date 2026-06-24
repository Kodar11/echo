import { Trie } from './trie.js';

export function findPrefixMatches(trie: Trie, prefix: string): string[] {
  if (!prefix || prefix.length === 0) return [];
  return trie.find(prefix.toLowerCase());
}
