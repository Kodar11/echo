import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  closeDatabase,
  setDatabasePath,
} from '../database/connection.js';

export function setupTestDatabase(): { dbPath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  setDatabasePath(dbPath);
  return { dbPath };
}

export function teardownTestDatabase(dbPath: string): void {
  closeDatabase();
  try {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures.
  }
}
