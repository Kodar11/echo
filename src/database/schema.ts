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
  last_index_duration_ms INTEGER,
  average_index_duration_ms INTEGER,
  total_indexing_runs INTEGER NOT NULL DEFAULT 0,
  total_indexed_files INTEGER NOT NULL DEFAULT 0,
  total_indexed_terms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS IndexingRuns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  files_indexed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS Settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terms_term ON Terms(term);
CREATE INDEX IF NOT EXISTS idx_postings_term_id ON Postings(term_id);
CREATE INDEX IF NOT EXISTS idx_postings_file_id ON Postings(file_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON Files(path);
CREATE INDEX IF NOT EXISTS idx_indexing_runs_completed_at ON IndexingRuns(completed_at);
`;
