/**
 * Canonical database schema.
 *
 * A freshly created database is built from SCHEMA_SQL and stamped with
 * SCHEMA_VERSION (stored in `PRAGMA user_version` and in the Migrations table).
 * Future schema changes must be expressed as ordered migrations in
 * src/services/migration/MigrationManager.ts that bump SCHEMA_VERSION, and
 * SCHEMA_SQL must always describe the final (latest) shape.
 *
 * Conventions:
 * - All timestamps are integer milliseconds since the Unix epoch.
 * - File paths are stored as absolute, resolved paths (see normalizeFsPath).
 * - Terms.document_frequency always equals the number of Postings rows for the
 *   term. Terms with no postings are deleted in the same transaction that
 *   removed their last posting.
 */

export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  modified_time INTEGER NOT NULL,
  doc_length INTEGER NOT NULL DEFAULT 0 CHECK (doc_length >= 0),
  indexed_at INTEGER NOT NULL,
  language TEXT,
  content_hash TEXT,
  author TEXT,
  created_at INTEGER,
  extension TEXT
);

CREATE TABLE IF NOT EXISTS Terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  document_frequency INTEGER NOT NULL DEFAULT 0 CHECK (document_frequency >= 0)
);

CREATE TABLE IF NOT EXISTS Postings (
  term_id INTEGER NOT NULL REFERENCES Terms(id),
  file_id INTEGER NOT NULL REFERENCES Files(id) ON DELETE CASCADE,
  term_frequency INTEGER NOT NULL CHECK (term_frequency > 0),
  positions TEXT NOT NULL,
  PRIMARY KEY (term_id, file_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS IndexedFolders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  added_at INTEGER NOT NULL,
  last_synced_at INTEGER
);

CREATE TABLE IF NOT EXISTS IndexMetadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'never_indexed',
  last_run_id INTEGER,
  last_run_status TEXT,
  last_indexed_at INTEGER,
  last_synced_at INTEGER,
  last_index_duration_ms INTEGER,
  average_index_duration_ms INTEGER,
  total_indexing_runs INTEGER NOT NULL DEFAULT 0,
  total_indexed_files INTEGER NOT NULL DEFAULT 0,
  total_indexed_terms INTEGER NOT NULL DEFAULT 0,
  ignored_files_count INTEGER NOT NULL DEFAULT 0,
  unsupported_files_count INTEGER NOT NULL DEFAULT 0,
  oversized_files_count INTEGER NOT NULL DEFAULT 0,
  inaccessible_files_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL,
  index_version INTEGER NOT NULL DEFAULT 1,
  app_version TEXT,
  created_at INTEGER NOT NULL,
  last_migration_at INTEGER,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS IndexingRuns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL DEFAULT 'manual',
  kind TEXT NOT NULL DEFAULT 'full',
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress',
  files_discovered INTEGER NOT NULL DEFAULT 0,
  files_added INTEGER NOT NULL DEFAULT 0,
  files_modified INTEGER NOT NULL DEFAULT 0,
  files_deleted INTEGER NOT NULL DEFAULT 0,
  files_unchanged INTEGER NOT NULL DEFAULT 0,
  files_skipped INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  files_ignored INTEGER NOT NULL DEFAULT 0,
  files_indexed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS Settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS IndexingFailures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0 CHECK (ignored IN (0, 1)),
  size INTEGER,
  modified_time INTEGER
);

CREATE TABLE IF NOT EXISTS IgnoreRules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'glob' CHECK (type IN ('glob', 'folder')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  checksum TEXT
);

CREATE TABLE IF NOT EXISTS IndexLock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  context TEXT
);

CREATE INDEX IF NOT EXISTS idx_postings_file_id ON Postings(file_id);
CREATE INDEX IF NOT EXISTS idx_terms_zero_df ON Terms(document_frequency) WHERE document_frequency = 0;
CREATE INDEX IF NOT EXISTS idx_files_language ON Files(language);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON Files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_extension ON Files(extension);
CREATE INDEX IF NOT EXISTS idx_indexing_runs_started_at ON IndexingRuns(started_at);
CREATE INDEX IF NOT EXISTS idx_indexing_runs_status ON IndexingRuns(status);
`;

/** Tables every compatible database must contain. */
export const REQUIRED_TABLES = [
  'Files',
  'Terms',
  'Postings',
  'IndexedFolders',
  'IndexMetadata',
  'IndexingRuns',
  'Settings',
  'IndexingFailures',
  'IgnoreRules',
  'Migrations',
  'IndexLock',
] as const;
