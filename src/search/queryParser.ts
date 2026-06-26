import { normalizeText } from '../language/normalize.js';

export type QueryNode =
  | TermNode
  | PhraseNode
  | AndNode
  | OrNode
  | NotNode
  | FilterNode;

export interface TermNode {
  type: 'term';
  value: string;
}

export interface PhraseNode {
  type: 'phrase';
  value: string;
  terms: string[];
}

export interface AndNode {
  type: 'and';
  left: QueryNode;
  right: QueryNode;
}

export interface OrNode {
  type: 'or';
  left: QueryNode;
  right: QueryNode;
}

export interface NotNode {
  type: 'not';
  child: QueryNode;
}

export interface FilterNode {
  type: 'filter';
  key: string;
  operator: string;
  value: string;
}

export interface ParsedQuery {
  root: QueryNode | null;
  hasFilters: boolean;
}

type Token =
  | { type: 'TERM'; value: string }
  | { type: 'PHRASE'; value: string; terms: string[] }
  | { type: 'OPERATOR'; value: 'AND' | 'OR' | 'NOT' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'FILTER'; key: string; operator: string; value: string }
  | { type: 'EOF' };

export class QueryParser {
  private tokens: Token[] = [];
  private position = 0;

  parse(input: string): ParsedQuery {
    this.tokens = tokenize(input);
    this.position = 0;

    if (this.current().type === 'EOF') {
      return { root: null, hasFilters: false };
    }

    const root = this.parseExpression();
    const hasFilters = this.tokens.some((t) => t.type === 'FILTER');

    return { root, hasFilters };
  }

  private parseExpression(): QueryNode {
    return this.parseOr();
  }

  private parseOr(): QueryNode {
    let left = this.parseAnd();
    while (this.matchOperator('OR')) {
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): QueryNode {
    let left = this.parseNot();
    while (true) {
      const op = this.peekOperator();
      if (op === 'OR') break;
      if (op === null && !this.isOperandStart()) break;

      if (op === 'AND') {
        this.consume('OPERATOR');
      }

      const right = this.parseNot();
      left = { type: 'and', left, right };
    }
    return left;
  }

  private parseNot(): QueryNode {
    if (this.matchOperator('NOT')) {
      return { type: 'not', child: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const token = this.current();

    if (token.type === 'TERM') {
      this.consume('TERM');
      return { type: 'term', value: token.value };
    }

    if (token.type === 'PHRASE') {
      this.consume('PHRASE');
      return { type: 'phrase', value: token.value, terms: token.terms };
    }

    if (token.type === 'FILTER') {
      this.consume('FILTER');
      return {
        type: 'filter',
        key: token.key,
        operator: token.operator,
        value: token.value,
      };
    }

    if (token.type === 'LPAREN') {
      this.consume('LPAREN');
      const expr = this.parseExpression();
      this.consume('RPAREN');
      return expr;
    }

    this.position++;
    return { type: 'term', value: '' };
  }

  private isOperandStart(): boolean {
    const type = this.current().type;
    return type === 'TERM' || type === 'PHRASE' || type === 'FILTER' || type === 'LPAREN';
  }

  private current(): Token {
    return this.tokens[this.position] ?? { type: 'EOF' };
  }

  private consume(expectedType: Token['type']): Token {
    const token = this.current();
    if (token.type !== expectedType) {
      throw new Error(
        `Expected ${expectedType} but got ${token.type} at position ${this.position}`
      );
    }
    this.position++;
    return token;
  }

  private matchOperator(value: 'AND' | 'OR' | 'NOT'): boolean {
    const token = this.current();
    if (token.type !== 'OPERATOR' || token.value !== value) return false;
    this.position++;
    return true;
  }

  private peekOperator(): 'AND' | 'OR' | 'NOT' | null {
    const token = this.current();
    if (token.type === 'OPERATOR') return token.value;
    return null;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const normalized = input.trim();

  while (i < normalized.length) {
    const char = normalized[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }

    if (char === '"') {
      const end = normalized.indexOf('"', i + 1);
      if (end === -1) {
        const value = normalizeText(normalized.slice(i + 1).trim());
        if (value) {
          tokens.push({
            type: 'PHRASE',
            value,
            terms: value.split(/[^\p{L}\p{N}]+/u).filter(Boolean),
          });
        }
        break;
      }
      const value = normalizeText(normalized.slice(i + 1, end).trim());
      if (value) {
        tokens.push({
          type: 'PHRASE',
          value,
          terms: value.split(/[^\p{L}\p{N}]+/u).filter(Boolean),
        });
      }
      i = end + 1;
      continue;
    }

    let j = i;
    while (
      j < normalized.length &&
      !/\s/.test(normalized[j]) &&
      normalized[j] !== '(' &&
      normalized[j] !== ')'
    ) {
      j++;
    }

    const raw = normalized.slice(i, j);
    const upper = raw.toUpperCase();

    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: 'OPERATOR', value: upper });
      i = j;
      continue;
    }

    const filterMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9]*)(:|>=|<=|>|<)/);
    if (filterMatch) {
      const key = filterMatch[1].toLowerCase();
      const operator = filterMatch[2];
      let value = raw.slice(filterMatch[0].length);

      if (value.startsWith('"')) {
        const valueStart = i + filterMatch[0].length + 1;
        const quoteEnd = normalized.indexOf('"', valueStart);
        if (quoteEnd !== -1) {
          value = normalized.slice(valueStart, quoteEnd);
          j = quoteEnd + 1;
        } else {
          value = normalized.slice(valueStart);
          j = normalized.length;
        }
      }

      tokens.push({ type: 'FILTER', key, operator, value });
      i = j;
      continue;
    }

    tokens.push({ type: 'TERM', value: normalizeText(raw) });
    i = j;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

export function parseQuery(input: string): ParsedQuery {
  return new QueryParser().parse(input);
}
