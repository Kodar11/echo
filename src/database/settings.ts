import { getDatabase } from './connection.js';

export function getSetting(key: string, defaultValue?: string): string | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM Settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run(
    key,
    value
  );
}

export function getBooleanSetting(key: string, defaultValue = false): boolean {
  const raw = getSetting(key);
  if (raw === undefined) return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function setBooleanSetting(key: string, value: boolean): void {
  setSetting(key, value ? '1' : '0');
}

export function getAllSettings(): Record<string, string> {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT key, value FROM Settings')
    .all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
