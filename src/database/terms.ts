import { getDatabase } from './connection.js';

export interface TermRecord {
  id: number;
  term: string;
  document_frequency: number;
}

export function getOrCreateTerm(term: string): number {
  const db = getDatabase();
  const existing = db
    .prepare('SELECT id FROM Terms WHERE term = ?')
    .get(term) as { id: number } | undefined;
  if (existing) {
    return existing.id;
  }
  const result = db
    .prepare('INSERT INTO Terms (term, document_frequency) VALUES (?, 0)')
    .run(term);
  return Number(result.lastInsertRowid);
}

export function getTermById(id: number): TermRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM Terms WHERE id = ?').get(id) as
    | TermRecord
    | undefined;
}

export function getTermByText(term: string): TermRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM Terms WHERE term = ?').get(term) as
    | TermRecord
    | undefined;
}

export function getAllTerms(): TermRecord[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM Terms').all() as TermRecord[];
}

export function incrementDocumentFrequency(termId: number): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE Terms SET document_frequency = document_frequency + 1 WHERE id = ?'
  ).run(termId);
}

export function decrementDocumentFrequency(termId: number): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE Terms SET document_frequency = MAX(0, document_frequency - 1) WHERE id = ?'
  ).run(termId);
}

export function updateDocumentFrequency(termId: number, count: number): void {
  const db = getDatabase();
  db.prepare('UPDATE Terms SET document_frequency = ? WHERE id = ?').run(
    count,
    termId
  );
}
