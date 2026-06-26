export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  modified_time INTEGER NOT NULL,
  doc_length INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL,
  language TEXT,
  content_hash TEXT,
  author TEXT,
  created_at INTEGER,
  extension TEXT
);

CREATE TABLE IF NOT EXISTS Terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT UNIQUE NOT NULL,
  document_frequency INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Postings (
  term_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  term_frequency INTEGER NOT NULL,
  positions TEXT NOT NULL,
  PRIMARY KEY (term_id, file_id),
  FOREIGN KEY (term_id) REFERENCES Terms(id),
  FOREIGN KEY (file_id) REFERENCES Files(id)
);

CREATE TABLE IF NOT EXISTS IndexedFolders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS IndexMetadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'never_indexed',
  last_indexed_at INTEGER,
  last_synced_at INTEGER,
  last_index_duration_ms INTEGER,
  average_index_duration_ms INTEGER,
  total_indexing_runs INTEGER NOT NULL DEFAULT 0,
  total_indexed_files INTEGER NOT NULL DEFAULT 0,
  total_indexed_terms INTEGER NOT NULL DEFAULT 0,
  ignored_files_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1,
  index_version INTEGER NOT NULL DEFAULT 1,
  app_version TEXT,
  created_at INTEGER,
  last_migration_at INTEGER,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS IndexingRuns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  files_indexed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS Settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS IndexingFailures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS IgnoreRules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'glob',
  enabled INTEGER NOT NULL DEFAULT 1,
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

CREATE INDEX IF NOT EXISTS idx_terms_term ON Terms(term);
CREATE INDEX IF NOT EXISTS idx_postings_term_id ON Postings(term_id);
CREATE INDEX IF NOT EXISTS idx_postings_file_id ON Postings(file_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON Files(path);
CREATE INDEX IF NOT EXISTS idx_indexing_runs_completed_at ON IndexingRuns(completed_at);
CREATE INDEX IF NOT EXISTS idx_files_language ON Files(language);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON Files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_author ON Files(author);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON Files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_extension ON Files(extension);
`;
