import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupManager } from './BackupManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';

describe('BackupManager', () => {
  let dbInfo: { dbPath: string };
  let manager: BackupManager;
  let tmpDir: string;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new BackupManager();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-backup-'));
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures.
    }
  });

  it('exports a valid backup zip', async () => {
    const backupPath = path.join(tmpDir, 'backup');
    await manager.exportBackup(backupPath);

    const expectedPath = `${backupPath}.zip`;
    expect(fs.existsSync(expectedPath)).toBe(true);

    const validation = await manager.validateBackup(expectedPath);
    expect(validation.valid).toBe(true);
  });

  it('fails validation for a missing backup file', async () => {
    const validation = await manager.validateBackup(
      path.join(tmpDir, 'missing.zip')
    );
    expect(validation.valid).toBe(false);
  });

  it('fails validation for an invalid zip', async () => {
    const invalidPath = path.join(tmpDir, 'invalid.zip');
    fs.writeFileSync(invalidPath, 'not a zip');
    const validation = await manager.validateBackup(invalidPath);
    expect(validation.valid).toBe(false);
  });
});
