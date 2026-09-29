import { tokenizeText } from '../language/languageProcessor.js';
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

export interface QueryError {
  kind: 'syntax' | 'filter';
  message: string;
  /** Character offset in the input, when known. */
  position?: number;
}

export interface ParsedQuery {
  root: QueryNode | null;
  hasFilters: boolean;
  error?: QueryError;
}

type Token =
  | { type: 'TERM'; value: string; pos: number }
  | { type: 'PHRASE'; value: string; terms: string[]; pos: number }
  | { type: 'OPERATOR'; value: 'AND' | 'OR' | 'NOT'; pos: number }
  | { type: 'LPAREN'; pos: number }
  | { type: 'RPAREN'; pos: number }
  | { type: 'FILTER'; key: string; operator: string; value: string; pos: number }
  | { type: 'EOF'; pos: number };

class QuerySyntaxError extends Error {
  constructor(message: string, readonly position: number) {
    super(message);
  }
}

/**
 * Grammar (AND binds tighter than OR; adjacent operands are implicitly ANDed):
 *
 *   expr    := and (OR and)*
 *   and     := not ((AND)? not)*
 *   not     := NOT not | primary
 *   primary := TERM | "PHRASE" | key:value | ( expr )
 *
 * Operators are case-insensitive. Malformed input never throws: it produces a
 * ParsedQuery with a structured `error` and a null root.
 */
export class QueryParser {
  private tokens: Token[] = [];
  private position = 0;

  parse(input: string): ParsedQuery {
    try {
      this.tokens = lex(input);
      this.position = 0;

      if (this.current().type === 'EOF') {
        return { root: null, hasFilters: false };
      }

      const root = this.parseOr();
      const next = this.current();
      if (next.type === 'RPAREN') {
        throw new QuerySyntaxError('Unmatched closing parenthesis', next.pos);
      }
      if (next.type !== 'EOF') {
        throw new QuerySyntaxError('Unexpected input', next.pos);
      }

      return { root, hasFilters: this.tokens.some((t) => t.type === 'FILTER') };
    } catch (err) {
      if (err instanceof QuerySyntaxError) {
        return {
          root: null,
          hasFilters: false,
          error: { kind: 'syntax', message: err.message, position: err.position },
        };
      }
      throw err;
    }
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
    for (;;) {
      const token = this.current();
      if (token.type === 'OPERATOR' && token.value === 'AND') {
        this.position++;
      } else if (!(token.type === 'OPERATOR' && token.value === 'NOT') && !this.isOperandStart()) {
        break;
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
    switch (token.type) {
      case 'TERM':
        this.position++;
        return { type: 'term', value: token.value };
      case 'PHRASE':
        this.position++;
        return { type: 'phrase', value: token.value, terms: token.terms };
      case 'FILTER':
        this.position++;
        return { type: 'filter', key: token.key, operator: token.operator, value: token.value };
      case 'LPAREN': {
        this.position++;
        if (this.current().type === 'RPAREN') {
          throw new QuerySyntaxError('Empty parentheses', token.pos);
        }
        const expr = this.parseOr();
        const closing = this.current();
        if (closing.type !== 'RPAREN') {
          throw new QuerySyntaxError('Missing closing parenthesis', token.pos);
        }
        this.position++;
        return expr;
      }
      case 'OPERATOR':
        throw new QuerySyntaxError(`Missing search term before ${token.value}`, token.pos);
      case 'RPAREN':
        throw new QuerySyntaxError('Unexpected closing parenthesis', token.pos);
      case 'EOF':
        throw new QuerySyntaxError('Query ends with an operator', token.pos);
    }
  }

  private isOperandStart(): boolean {
    const type = this.current().type;
    return type === 'TERM' || type === 'PHRASE' || type === 'FILTER' || type === 'LPAREN';
  }

  private current(): Token {
    return this.tokens[this.position] ?? { type: 'EOF', pos: -1 };
  }

  private matchOperator(value: 'AND' | 'OR' | 'NOT'): boolean {
    const token = this.current();
    if (token.type !== 'OPERATOR' || token.value !== value) return false;
    this.position++;
    return true;
  }
}

const FILTER_PREFIX = /^([a-zA-Z][a-zA-Z0-9]*)(>=|<=|:|>|<)/;

function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'LPAREN', pos: i });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', pos: i });
      i++;
      continue;
    }

    if (char === '"') {
      const end = input.indexOf('"', i + 1);
      if (end === -1) {
        throw new QuerySyntaxError('Unclosed quote', i);
      }
      const raw = input.slice(i + 1, end);
      const terms = tokenizeText(raw);
      if (terms.length === 0) {
        throw new QuerySyntaxError('Empty phrase', i);
      }
      // Always a phrase, even for one word: quotes mean "exactly this",
      // without prefix / fuzzy / stem expansion.
      tokens.push({ type: 'PHRASE', value: normalizeText(raw), terms, pos: i });
      i = end + 1;
      continue;
    }

    let j = i;
    while (j < input.length && !/\s/.test(input[j]) && input[j] !== '(' && input[j] !== ')') {
      j++;
    }
    const raw = input.slice(i, j);
    const upper = raw.toUpperCase();

    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: 'OPERATOR', value: upper, pos: i });
      i = j;
      continue;
    }

    const filterMatch = raw.match(FILTER_PREFIX);
    if (filterMatch) {
      const key = filterMatch[1].toLowerCase();
      const operator = filterMatch[2];
      let value = raw.slice(filterMatch[0].length);

      if (value.startsWith('"')) {
        const valueStart = i + filterMatch[0].length + 1;
        const quoteEnd = input.indexOf('"', valueStart);
        if (quoteEnd === -1) {
          throw new QuerySyntaxError('Unclosed quote in filter value', valueStart - 1);
        }
        value = input.slice(valueStart, quoteEnd);
        j = quoteEnd + 1;
      }

      if (value.trim() === '') {
        throw new QuerySyntaxError(`Filter "${key}${operator}" needs a value`, i);
      }

      tokens.push({ type: 'FILTER', key, operator, value, pos: i });
      i = j;
      continue;
    }

    // Bare words use the indexing tokenizer: punctuation-only words vanish,
    // and a word that splits into several tokens ("foo-bar") is a phrase.
    const terms = tokenizeText(raw);
    if (terms.length > 0) {
      tokens.push(makePhraseOrTerm(raw, terms, i));
    }
    i = j;
  }

  tokens.push({ type: 'EOF', pos: input.length });
  return tokens;
}

function makePhraseOrTerm(raw: string, terms: string[], pos: number): Token {
  if (terms.length === 1) {
    return { type: 'TERM', value: terms[0], pos };
  }
  return { type: 'PHRASE', value: normalizeText(raw), terms, pos };
}

export function parseQuery(input: string): ParsedQuery {
  return new QueryParser().parse(input);
}
