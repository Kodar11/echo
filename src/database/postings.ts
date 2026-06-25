import { getDatabase } from './connection.js';

export interface PostingRecord {
  term_id: number;
  file_id: number;
  term_frequency: number;
  positions: string;
}

export interface Posting {
  termId: number;
  fileId: number;
  termFrequency: number;
  positions: number[];
}

export function insertPosting(
  termId: number,
  fileId: number,
  termFrequency: number,
  positions: number[]
): void {
  const db = getDatabase();
  const existing = db
    .prepare('SELECT 1 FROM Postings WHERE term_id = ? AND file_id = ?')
    .get(termId, fileId) as { term_id: number } | undefined;

  db.prepare(
    'INSERT OR REPLACE INTO Postings (term_id, file_id, term_frequency, positions) VALUES (?, ?, ?, ?)'
  ).run(termId, fileId, termFrequency, JSON.stringify(positions));

  if (!existing) {
    db.prepare(
      'UPDATE Terms SET document_frequency = document_frequency + 1 WHERE id = ?'
    ).run(termId);
  }
}

export function getPostingsForTerm(termId: number): Posting[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM Postings WHERE term_id = ?')
    .all(termId) as PostingRecord[];
  return rows.map((row) => ({
    termId: row.term_id,
    fileId: row.file_id,
    termFrequency: row.term_frequency,
    positions: JSON.parse(row.positions) as number[],
  }));
}

export function getPostingsForFile(fileId: number): Posting[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM Postings WHERE file_id = ?')
    .all(fileId) as PostingRecord[];
  return rows.map((row) => ({
    termId: row.term_id,
    fileId: row.file_id,
    termFrequency: row.term_frequency,
    positions: JSON.parse(row.positions) as number[],
  }));
}

export function deletePostingsForFile(fileId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM Postings WHERE file_id = ?').run(fileId);
}

export function deletePostingsForFileReturningTerms(fileId: number): number[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT term_id FROM Postings WHERE file_id = ?')
    .all(fileId) as { term_id: number }[];
  const termIds = rows.map((row) => row.term_id);

  db.prepare('DELETE FROM Postings WHERE file_id = ?').run(fileId);

  for (const termId of termIds) {
    db.prepare(
      'UPDATE Terms SET document_frequency = MAX(0, document_frequency - 1) WHERE id = ?'
    ).run(termId);
  }

  return termIds;
}

export function deleteAllPostings(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM Postings').run();
}
