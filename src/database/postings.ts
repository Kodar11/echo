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
  db.prepare(
    'INSERT OR REPLACE INTO Postings (term_id, file_id, term_frequency, positions) VALUES (?, ?, ?, ?)'
  ).run(termId, fileId, termFrequency, JSON.stringify(positions));
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
