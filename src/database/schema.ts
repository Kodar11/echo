export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  modified_time INTEGER NOT NULL,
  doc_length INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_terms_term ON Terms(term);
CREATE INDEX IF NOT EXISTS idx_postings_term_id ON Postings(term_id);
CREATE INDEX IF NOT EXISTS idx_postings_file_id ON Postings(file_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON Files(path);
`;
