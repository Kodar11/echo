import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { getDatabase, getDatabasePath } from '../../database/connection.js';
import { getAllSettings } from '../../database/settings.js';
import { getLogger } from '../logger/logger.js';

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
}

const REQUIRED_TABLES = [
  'Files',
  'Terms',
  'Postings',
  'IndexedFolders',
  'IndexMetadata',
  'IndexingRuns',
  'Settings',
];

export class BackupManager {
  async exportBackup(destinationPath: string): Promise<void> {
    const db = getDatabase();
    const settings = getAllSettings();

    const tempDir = path.join(
      path.dirname(getDatabasePath()),
      `backup-${Date.now()}`
    );
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const snapshotPath = path.join(tempDir, 'echo.db');
      await db.backup(snapshotPath);

      const zip = new AdmZip();
      zip.addLocalFile(snapshotPath, '', 'echo.db');
      zip.addFile(
        'settings.json',
        Buffer.from(JSON.stringify(settings, null, 2), 'utf-8')
      );

      // Ensure .zip extension.
      const finalPath = destinationPath.endsWith('.zip')
        ? destinationPath
        : `${destinationPath}.zip`;

      await new Promise<void>((resolve, reject) => {
        zip.writeZip(finalPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      getLogger().info(
        'index',
        'BackupManager',
        `Exported backup to ${finalPath}`
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async importBackup(sourcePath: string): Promise<void> {
    const validation = await this.validateBackup(sourcePath);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid backup');
    }

    const dbPath = getDatabasePath();
    const backupDir = path.dirname(dbPath);
    const tempDir = path.join(backupDir, `restore-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const zip = new AdmZip(sourcePath);
      zip.extractAllTo(tempDir, true);

      const backupDbPath = path.join(tempDir, 'echo.db');
      if (!fs.existsSync(backupDbPath)) {
        throw new Error('Backup is missing echo.db');
      }

      // Replace current database.
      fs.copyFileSync(backupDbPath, dbPath);

      getLogger().info(
        'index',
        'BackupManager',
        `Imported backup from ${sourcePath}`
      );
    } finally {
      // Clean up temp files.
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async validateBackup(sourcePath: string): Promise<BackupValidationResult> {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { valid: false, error: 'Backup file not found' };
      }

      const zip = new AdmZip(sourcePath);
      const entries = zip.getEntries();
      const hasDb = entries.some((e) => e.entryName === 'echo.db');
      const hasSettings = entries.some(
        (e) => e.entryName === 'settings.json'
      );

      if (!hasDb) {
        return { valid: false, error: 'Backup is missing echo.db' };
      }

      const tempDir = path.join(
        path.dirname(getDatabasePath()),
        `validate-${Date.now()}`
      );
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        zip.extractAllTo(tempDir, true);
        const dbPath = path.join(tempDir, 'echo.db');
        const db = new Database(dbPath);
        const tables = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          )
          .all() as { name: string }[];
        db.close();

        const tableNames = tables.map((t) => t.name);
        const missing = REQUIRED_TABLES.filter(
          (t) => !tableNames.includes(t)
        );
        if (missing.length > 0) {
          return {
            valid: false,
            error: `Backup database is missing tables: ${missing.join(', ')}`,
          };
        }

        if (hasSettings) {
          const settingsRaw = fs.readFileSync(
            path.join(tempDir, 'settings.json'),
            'utf-8'
          );
          JSON.parse(settingsRaw);
        }

        return { valid: true };
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const backupManager = new BackupManager();
