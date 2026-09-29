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

function toPosting(row: PostingRecord): Posting {
  return {
    termId: row.term_id,
    fileId: row.file_id,
    termFrequency: row.term_frequency,
    positions: JSON.parse(row.positions) as number[],
  };
}

export function getPostingsForTerm(termId: number): Posting[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM Postings WHERE term_id = ?')
    .all(termId) as PostingRecord[];
  return rows.map(toPosting);
}

export function getPostingsForFile(fileId: number): Posting[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM Postings WHERE file_id = ?')
    .all(fileId) as PostingRecord[];
  return rows.map(toPosting);
}

export function getPostingCount(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) as count FROM Postings')
    .get() as { count: number };
  return row.count;
}
