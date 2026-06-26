import { getDatabase } from './connection.js';

export type IgnoreRuleType = 'glob' | 'folder';

export interface IgnoreRuleRecord {
  id: number;
  pattern: string;
  type: IgnoreRuleType;
  enabled: number;
  created_at: number;
}

export function addIgnoreRule(
  pattern: string,
  type: IgnoreRuleType = 'glob'
): IgnoreRuleRecord {
  const db = getDatabase();
  const result = db.prepare(
    'INSERT INTO IgnoreRules (pattern, type, enabled, created_at) VALUES (?, ?, 1, ?)'
  ).run(pattern, type, Date.now());

  return {
    id: Number(result.lastInsertRowid),
    pattern,
    type,
    enabled: 1,
    created_at: Date.now(),
  };
}

export function getIgnoreRules(): IgnoreRuleRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM IgnoreRules ORDER BY created_at DESC')
    .all() as IgnoreRuleRecord[];
}

export function getEnabledIgnoreRules(): IgnoreRuleRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM IgnoreRules WHERE enabled = 1 ORDER BY created_at DESC')
    .all() as IgnoreRuleRecord[];
}

export function setIgnoreRuleEnabled(id: number, enabled: boolean): void {
  const db = getDatabase();
  db.prepare('UPDATE IgnoreRules SET enabled = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    id
  );
}

export function deleteIgnoreRule(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM IgnoreRules WHERE id = ?').run(id);
}
