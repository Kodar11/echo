import path from 'path';
import type { FileRecord } from '../database/files.js';
import type { FilterNode } from './queryParser.js';

export function evaluateFilter(file: FileRecord, node: FilterNode): boolean {
  switch (node.key) {
    case 'type':
    case 'ext':
      return matchesType(file.path, node.value);
    case 'folder':
      return matchesFolder(file.path, node.value);
    case 'before':
      return matchesBefore(file.modified_time, node.value);
    case 'after':
      return matchesAfter(file.modified_time, node.value);
    case 'modified':
      return matchesModified(file.modified_time, node.operator, node.value);
    case 'size':
      return matchesSize(file.size, node.operator, node.value);
    default:
      return true;
  }
}

function matchesType(filePath: string, value: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const expected = value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`;
  return ext === expected;
}

function matchesFolder(filePath: string, value: string): boolean {
  const lowerPath = filePath.toLowerCase();
  const lowerValue = value.toLowerCase();
  return lowerPath.includes(lowerValue);
}

function matchesBefore(modifiedTime: number, value: string): boolean {
  const date = parseDate(value);
  if (!date) return true;
  return modifiedTime < date.getTime();
}

function matchesAfter(modifiedTime: number, value: string): boolean {
  const date = parseDate(value);
  if (!date) return true;
  return modifiedTime > date.getTime();
}

function matchesModified(
  modifiedTime: number,
  operator: string,
  value: string
): boolean {
  const date = parseDate(value);
  if (!date) return true;
  const time = date.getTime();
  switch (operator) {
    case ':':
    case '=':
      return modifiedTime === time;
    case '<':
      return modifiedTime < time;
    case '>':
      return modifiedTime > time;
    case '<=':
      return modifiedTime <= time;
    case '>=':
      return modifiedTime >= time;
    default:
      return true;
  }
}

function matchesSize(size: number, operator: string, value: string): boolean {
  const expected = parseSize(value);
  if (expected === null) return true;
  switch (operator) {
    case ':':
    case '=':
      return size === expected;
    case '<':
      return size < expected;
    case '>':
      return size > expected;
    case '<=':
      return size <= expected;
    case '>=':
      return size >= expected;
    default:
      return true;
  }
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  return date;
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
