import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (database: Database.Database) => void;
  down?: (database: Database.Database) => void;
}

export interface MigrationResult {
  success: boolean;
  currentVersion: number;
  targetVersion: number;
  applied: number[];
  error?: string;
}

const BASELINE_MIGRATION: Migration = {
  version: 1,
  name: 'baseline_phase7',
  up: (database) => {
    // Ensure Migrations table exists (it should from SCHEMA_SQL, but older DBs may need it).
    database.exec(`
      CREATE TABLE IF NOT EXISTS Migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        checksum TEXT
      )
    `);

    // Ensure IndexLock table exists.
    database.exec(`
      CREATE TABLE IF NOT EXISTS IndexLock (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        owner TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        context TEXT
      )
    `);

    // Phase 6 columns that may be missing in databases created before Phase 6.
    ensureColumn(database, 'Files', 'language', 'TEXT');
    ensureColumn(database, 'Files', 'content_hash', 'TEXT');
    ensureColumn(database, 'Files', 'author', 'TEXT');
    ensureColumn(database, 'Files', 'created_at', 'INTEGER');
    ensureColumn(database, 'Files', 'extension', 'TEXT');

    ensureColumn(database, 'IndexMetadata', 'ignored_files_count', 'INTEGER NOT NULL DEFAULT 0');

    // Phase 7 version columns.
    ensureColumn(database, 'IndexMetadata', 'schema_version', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn(database, 'IndexMetadata', 'index_version', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn(database, 'IndexMetadata', 'app_version', 'TEXT');
    ensureColumn(database, 'IndexMetadata', 'created_at', 'INTEGER');
    ensureColumn(database, 'IndexMetadata', 'last_migration_at', 'INTEGER');

    // Ensure default IndexMetadata row exists.
    database.exec(`
      INSERT OR IGNORE INTO IndexMetadata (id, status) VALUES (1, 'never_indexed')
    `);

    // Create indexes added in Phase 6 if missing.
    database.exec(`CREATE INDEX IF NOT EXISTS idx_files_language ON Files(language)`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_files_content_hash ON Files(content_hash)`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_files_author ON Files(author)`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_files_created_at ON Files(created_at)`);
    database.exec(`CREATE INDEX IF NOT EXISTS idx_files_extension ON Files(extension)`);

    // Ensure IndexingRuns has a sensible default status.
    database.exec(`
      UPDATE IndexingRuns SET status = 'failed', error_message = 'Interrupted before Phase 7'
      WHERE status IS NULL OR status = ''
    `);

    // Mark baseline version in metadata.
    database.exec(`UPDATE IndexMetadata SET schema_version = 1, index_version = 1 WHERE id = 1`);
  },
};

const MIGRATIONS: Migration[] = [BASELINE_MIGRATION];

export class MigrationManager {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  getCurrentVersion(): number {
    try {
      const row = this.database
        .prepare('SELECT MAX(version) as version FROM Migrations')
        .get() as { version: number | null } | undefined;
      return row?.version ?? 0;
    } catch {
      return 0;
    }
  }

  getTargetVersion(): number {
    return MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
  }

  migrate(): MigrationResult {
    const currentVersion = this.getCurrentVersion();
    const targetVersion = this.getTargetVersion();
    const applied: number[] = [];

    if (currentVersion === targetVersion) {
      return { success: true, currentVersion, targetVersion, applied };
    }

    const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
      (a, b) => a.version - b.version
    );

    for (const migration of pending) {
      try {
        this.applyMigration(migration);
        applied.push(migration.version);
      } catch (err) {
        return {
          success: false,
          currentVersion: this.getCurrentVersion(),
          targetVersion,
          applied,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      success: true,
      currentVersion: this.getCurrentVersion(),
      targetVersion,
      applied,
    };
  }

  private applyMigration(migration: Migration): void {
    const migrate = this.database.transaction(() => {
      migration.up(this.database);
      this.database
        .prepare(
          'INSERT OR REPLACE INTO Migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
        )
        .run(migration.version, migration.name, Date.now(), null);
    });

    migrate();

    this.database
      .prepare('UPDATE IndexMetadata SET last_migration_at = ? WHERE id = 1')
      .run(Date.now());
  }
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  type: string
): void {
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
