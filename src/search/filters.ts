import path from 'path';
import type { FileRecord } from '../database/files.js';
import type { FilterNode } from './queryParser.js';

export function evaluateFilter(file: FileRecord, node: FilterNode): boolean {
  switch (node.key) {
    case 'type':
    case 'ext':
    case 'extension':
      return matchesType(file, node.value);
    case 'folder':
      return matchesFolder(file.path, node.value);
    case 'before':
      return matchesBefore(file.modified_time, node.value);
    case 'after':
      return matchesAfter(file.modified_time, node.value);
    case 'modified':
      return matchesModified(file.modified_time, node.operator, node.value);
    case 'created':
      return matchesCreated(file, node.operator, node.value);
    case 'size':
      return matchesSize(file.size, node.operator, node.value);
    case 'author':
      return matchesAuthor(file, node.value);
    case 'language':
      return matchesLanguage(file, node.value);
    default:
      return true;
  }
}

function matchesType(file: FileRecord, value: string): boolean {
  const ext = (file.extension ?? path.extname(file.path)).toLowerCase();
  const expected = value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`;
  return ext === expected;
}

function matchesFolder(filePath: string, value: string): boolean {
  const lowerPath = filePath.toLowerCase();
  const lowerValue = value.toLowerCase();
  return lowerPath.includes(lowerValue);
}

function matchesBefore(modifiedTime: number, value: string): boolean {
  const range = parseDateRange(value);
  if (!range) return true;
  return modifiedTime < range.start;
}

function matchesAfter(modifiedTime: number, value: string): boolean {
  const range = parseDateRange(value);
  if (!range) return true;
  return modifiedTime > range.start;
}

function matchesModified(
  modifiedTime: number,
  operator: string,
  value: string
): boolean {
  const range = parseDateRange(value);
  if (!range) return true;
  return compareDateRange(modifiedTime, operator, range);
}

function matchesCreated(
  file: FileRecord,
  operator: string,
  value: string
): boolean {
  const createdTime = file.created_at ?? file.modified_time;
  const range = parseDateRange(value);
  if (!range) return true;
  return compareDateRange(createdTime, operator, range);
}

function matchesSize(size: number, operator: string, value: string): boolean {
  const expected = parseSize(value);
  if (expected === null) return true;
  return compareNumber(size, operator, expected);
}

function matchesAuthor(file: FileRecord, value: string): boolean {
  if (!file.author) return false;
  return file.author.toLowerCase().includes(value.toLowerCase());
}

function matchesLanguage(file: FileRecord, value: string): boolean {
  if (!file.language) return false;
  return file.language.toLowerCase() === value.toLowerCase();
}

function compareNumber(
  actual: number,
  operator: string,
  expected: number
): boolean {
  switch (operator) {
    case ':':
    case '=':
      return actual === expected;
    case '<':
      return actual < expected;
    case '>':
      return actual > expected;
    case '<=':
      return actual <= expected;
    case '>=':
      return actual >= expected;
    default:
      return true;
  }
}

interface DateRange {
  start: number;
  end: number;
}

function parseDateRange(value: string): DateRange | null {
  const trimmed = value.trim().toLowerCase();
  const relative = parseRelativeDateRange(trimmed);
  if (relative) return relative;

  const date = new Date(value.trim());
  if (isNaN(date.getTime())) return null;
  return { start: date.getTime(), end: date.getTime() };
}

function compareDateRange(
  time: number,
  operator: string,
  range: DateRange
): boolean {
  // For exact-match operators on a day-range, match any point within the day.
  if ((operator === ':' || operator === '=') && range.start !== range.end) {
    return time >= range.start && time < range.end;
  }

  return compareNumber(time, operator, range.start);
}

function parseRelativeDateRange(value: string): DateRange | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (value === 'today') {
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    return { start: now.getTime(), end: end.getTime() };
  }

  if (value === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    return { start: start.getTime(), end: end.getTime() };
  }

  const match = value.match(/^last(\d+)(days?|weeks?|months?|years?)$/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const start = new Date(now);

  if (unit.startsWith('day')) {
    start.setDate(start.getDate() - amount);
  } else if (unit.startsWith('week')) {
    start.setDate(start.getDate() - amount * 7);
  } else if (unit.startsWith('month')) {
    start.setMonth(start.getMonth() - amount);
  } else if (unit.startsWith('year')) {
    start.setFullYear(start.getFullYear() - amount);
  }

  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function parseSize(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'b';

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(num * multipliers[unit]);
}
