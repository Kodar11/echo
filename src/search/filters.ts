import path from 'path';
import type { FileRecord } from '../database/files.js';
import type { FilterNode } from './queryParser.js';

/**
 * Query filters (`key:value`, `key>value`, …). Every filter is validated when
 * the query is compiled; an unknown key, operator or unparsable value is an
 * error reported to the user, never a filter that silently matches everything.
 */

export type FilterPredicate = (file: FileRecord) => boolean;

export class FilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterError';
  }
}

type Operator = ':' | '<' | '>' | '<=' | '>=';

const EQUALITY_ONLY: Operator[] = [':'];
const COMPARISON: Operator[] = [':', '<', '>', '<=', '>='];

const LANGUAGE_ALIASES: Record<string, string> = {
  eng: 'eng',
  en: 'eng',
  english: 'eng',
  hin: 'hin',
  hi: 'hin',
  hindi: 'hin',
  mar: 'mar',
  mr: 'mar',
  marathi: 'mar',
};

interface FilterDefinition {
  operators: Operator[];
  compile: (operator: Operator, value: string) => FilterPredicate;
}

const DEFINITIONS: Record<string, FilterDefinition> = {
  type: { operators: EQUALITY_ONLY, compile: (_op, value) => compileType(value) },
  folder: { operators: EQUALITY_ONLY, compile: (_op, value) => compileFolder(value) },
  before: {
    operators: EQUALITY_ONLY,
    compile: (_op, value) => {
      const range = parseDateRange(value);
      return (file) => file.modified_time < range.start;
    },
  },
  after: {
    operators: EQUALITY_ONLY,
    compile: (_op, value) => {
      const range = parseDateRange(value);
      return (file) => file.modified_time >= range.end;
    },
  },
  modified: {
    operators: COMPARISON,
    compile: (op, value) => {
      const test = compareRange(op, parseDateRange(value));
      return (file) => test(file.modified_time);
    },
  },
  created: {
    operators: COMPARISON,
    compile: (op, value) => {
      const test = compareRange(op, parseDateRange(value));
      return (file) => test(file.created_at ?? file.modified_time);
    },
  },
  size: {
    operators: COMPARISON,
    compile: (op, value) => {
      const bytes = parseSize(value);
      return (file) => compareNumber(file.size, op, bytes);
    },
  },
  author: {
    operators: EQUALITY_ONLY,
    compile: (_op, value) => {
      const needle = value.toLowerCase();
      return (file) => (file.author ? file.author.toLowerCase().includes(needle) : false);
    },
  },
  language: {
    operators: EQUALITY_ONLY,
    compile: (_op, value) => {
      const code = LANGUAGE_ALIASES[value.trim().toLowerCase()];
      if (!code) {
        throw new FilterError(
          `Unknown language "${value}". Use one of: eng, hin, mar`
        );
      }
      return (file) => file.language === code;
    },
  },
};

const ALIASES: Record<string, string> = {
  ext: 'type',
  extension: 'type',
  lang: 'language',
};

export const FILTER_KEYS = [...Object.keys(DEFINITIONS), ...Object.keys(ALIASES)].sort();

/** Validates a filter and returns its predicate. Throws FilterError. */
export function compileFilter(node: FilterNode): FilterPredicate {
  const key = ALIASES[node.key] ?? node.key;
  const definition = DEFINITIONS[key];
  if (!definition) {
    throw new FilterError(
      `Unknown filter "${node.key}". Valid filters: ${FILTER_KEYS.join(', ')}. ` +
        'Put text in quotes to search for it literally.'
    );
  }
  const operator = node.operator === '=' ? ':' : (node.operator as Operator);
  if (!definition.operators.includes(operator)) {
    throw new FilterError(
      `Filter "${node.key}" does not support "${node.operator}" (use ${definition.operators.join(' ')})`
    );
  }
  const value = node.value.trim();
  if (!value) {
    throw new FilterError(`Filter "${node.key}" needs a value`);
  }
  return definition.compile(operator, value);
}

/** Convenience for one-off checks; throws FilterError for invalid filters. */
export function evaluateFilter(file: FileRecord, node: FilterNode): boolean {
  return compileFilter(node)(file);
}

function compileType(value: string): FilterPredicate {
  const normalized = value.toLowerCase().replace(/^\./, '');
  if (!/^[a-z0-9]{1,16}$/.test(normalized)) {
    throw new FilterError(`Invalid file type "${value}" (expected e.g. type:pdf)`);
  }
  const expected = `.${normalized}`;
  return (file) => (file.extension ?? path.extname(file.path)).toLowerCase() === expected;
}

function compileFolder(value: string): FilterPredicate {
  const needle = value.replace(/[\\/]+/g, '/').toLowerCase();
  return (file) => file.path.replace(/[\\/]+/g, '/').toLowerCase().includes(needle);
}

function compareNumber(actual: number, operator: Operator, expected: number): boolean {
  switch (operator) {
    case ':':
      return actual === expected;
    case '<':
      return actual < expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '>=':
      return actual >= expected;
  }
}

/** A half-open time interval [start, end) in epoch milliseconds. */
export interface DateRange {
  start: number;
  end: number;
}

/** Range semantics: `:` = within, `<` = before it, `>` = after it. */
function compareRange(operator: Operator, range: DateRange): (time: number) => boolean {
  switch (operator) {
    case ':':
      return (t) => t >= range.start && t < range.end;
    case '<':
      return (t) => t < range.start;
    case '<=':
      return (t) => t < range.end;
    case '>':
      return (t) => t >= range.end;
    case '>=':
      return (t) => t >= range.start;
  }
}

/**
 * Accepted forms (local time): YYYY, YYYY-MM, YYYY-MM-DD, full ISO date-time,
 * today, yesterday, lastN{days|weeks|months|years}.
 */
export function parseDateRange(value: string, now = new Date()): DateRange {
  const trimmed = value.trim().toLowerCase();

  const relative = parseRelativeDateRange(trimmed, now);
  if (relative) return relative;

  let match = trimmed.match(/^(\d{4})$/);
  if (match) {
    const year = Number(match[1]);
    return { start: new Date(year, 0, 1).getTime(), end: new Date(year + 1, 0, 1).getTime() };
  }

  match = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month < 0 || month > 11) throw invalidDate(value);
    return {
      start: new Date(year, month, 1).getTime(),
      end: new Date(year, month + 1, 1).getTime(),
    };
  }

  match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const start = new Date(year, month, day);
    if (start.getFullYear() !== year || start.getMonth() !== month || start.getDate() !== day) {
      throw invalidDate(value);
    }
    return { start: start.getTime(), end: new Date(year, month, day + 1).getTime() };
  }

  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/.test(trimmed)) {
    const time = new Date(value.trim()).getTime();
    if (Number.isNaN(time)) throw invalidDate(value);
    return { start: time, end: time + 1 };
  }

  throw invalidDate(value);
}

function invalidDate(value: string): FilterError {
  return new FilterError(
    `Invalid date "${value}" (use YYYY-MM-DD, YYYY-MM, YYYY, today, yesterday or e.g. last7days)`
  );
}

function parseRelativeDateRange(value: string, now: Date): DateRange | null {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (value === 'today') {
    return { start: today.getTime(), end: tomorrow.getTime() };
  }
  if (value === 'yesterday') {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    return { start: start.getTime(), end: today.getTime() };
  }

  const match = value.match(/^last(\d+)(days?|weeks?|months?|years?)$/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const start = new Date(today);
  if (unit.startsWith('day')) start.setDate(start.getDate() - amount);
  else if (unit.startsWith('week')) start.setDate(start.getDate() - amount * 7);
  else if (unit.startsWith('month')) start.setMonth(start.getMonth() - amount);
  else start.setFullYear(start.getFullYear() - amount);

  return { start: start.getTime(), end: tomorrow.getTime() };
}

const SIZE_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

export function parseSize(value: string): number {
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/);
  if (!match) {
    throw new FilterError(`Invalid size "${value}" (use e.g. 500KB, 10MB, 1.5GB)`);
  }
  return Math.round(parseFloat(match[1]) * SIZE_MULTIPLIERS[match[2] ?? 'b']);
}
