interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  term: string | null;
}

export class Trie {
  private root: TrieNode;

  constructor() {
    this.root = { children: new Map(), isEnd: false, term: null };
  }

  insert(term: string): void {
    let node = this.root;
    for (const char of term) {
      let child = node.children.get(char);
      if (!child) {
        child = { children: new Map(), isEnd: false, term: null };
        node.children.set(char, child);
      }
      node = child;
    }
    node.isEnd = true;
    node.term = term;
  }

  remove(term: string): void {
    this.removeHelper(this.root, term, 0);
  }

  private removeHelper(node: TrieNode, term: string, depth: number): boolean {
    if (depth === term.length) {
      if (!node.isEnd) return false;
      node.isEnd = false;
      node.term = null;
      return node.children.size === 0;
    }

    const char = term[depth];
    const child = node.children.get(char);
    if (!child) return false;

    const shouldDeleteChild = this.removeHelper(child, term, depth + 1);
    if (shouldDeleteChild) {
      node.children.delete(char);
      return node.children.size === 0 && !node.isEnd;
    }
    return false;
  }

  find(prefix: string): string[] {
    let node = this.root;
    for (const char of prefix) {
      node = node.children.get(char) as TrieNode;
      if (!node) return [];
    }
    return this.collectTerms(node);
  }

  private collectTerms(node: TrieNode): string[] {
    const results: string[] = [];
    if (node.isEnd && node.term) {
      results.push(node.term);
    }
    for (const child of node.children.values()) {
      results.push(...this.collectTerms(child));
    }
    return results;
  }

  has(term: string): boolean {
    let node = this.root;
    for (const char of term) {
      node = node.children.get(char) as TrieNode;
      if (!node) return false;
    }
    return node.isEnd;
  }

  clear(): void {
    this.root = { children: new Map(), isEnd: false, term: null };
  }

  buildFromTerms(terms: string[]): void {
    this.clear();
    for (const term of terms) {
      this.insert(term);
    }
  }
}
