import { getDatabase } from './connection.js';

export interface TermRecord {
  id: number;
  term: string;
  document_frequency: number;
}

export function getTermByText(term: string): TermRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM Terms WHERE term = ?')
    .get(term) as TermRecord | undefined;
}

export function getAllTerms(): TermRecord[] {
  return getDatabase().prepare('SELECT * FROM Terms').all() as TermRecord[];
}

export function getTermCount(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) as count FROM Terms')
    .get() as { count: number };
  return row.count;
}

/**
 * Ids of terms that occur in at least one document detected as `language`.
 * Used to build language-specific stemming tables.
 */
export function getTermIdsForLanguage(language: string): number[] {
  const rows = getDatabase()
    .prepare(
      `SELECT DISTINCT p.term_id AS id
       FROM Files f
       JOIN Postings p ON p.file_id = f.id
       WHERE f.language = ?`
    )
    .all(language) as { id: number }[];
  return rows.map((row) => row.id);
}
