import type Database from 'better-sqlite3';

interface ColumnMigration {
  column: string;
  type: string;
  index?: string;
}

const FILES_MIGRATIONS: ColumnMigration[] = [
  { column: 'language', type: 'TEXT', index: 'idx_files_language' },
  { column: 'content_hash', type: 'TEXT', index: 'idx_files_content_hash' },
  { column: 'author', type: 'TEXT', index: 'idx_files_author' },
  { column: 'created_at', type: 'INTEGER', index: 'idx_files_created_at' },
  { column: 'extension', type: 'TEXT', index: 'idx_files_extension' },
];

export function runMigrations(database: Database.Database): void {
  const columns = database
    .prepare('PRAGMA table_info(Files)')
    .all() as { name: string }[];
  const existing = new Set(columns.map((c) => c.name));

  for (const { column, type, index } of FILES_MIGRATIONS) {
    if (!existing.has(column)) {
      try {
        database.exec(`ALTER TABLE Files ADD COLUMN ${column} ${type}`);
      } catch (err) {
        console.error(`Migration failed: ADD COLUMN ${column}`, err);
        continue;
      }
    }

    if (index) {
      try {
        database.exec(
          `CREATE INDEX IF NOT EXISTS ${index} ON Files(${column})`
        );
      } catch (err) {
        console.error(`Index creation failed: ${index}`, err);
      }
    }
  }
}
