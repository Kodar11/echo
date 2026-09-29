import type Database from 'better-sqlite3';
import { getDatabase } from '../../database/connection.js';
import { SCHEMA_VERSION } from '../../database/schema.js';
import { validateSchema } from '../../database/schemaValidation.js';
import { getLogger } from '../logger/logger.js';

export type IntegrityIssueType =
  | 'schema_mismatch'
  | 'missing_metadata'
  | 'duplicate_metadata'
  | 'foreign_key_violation'
  | 'orphan_posting'
  | 'orphan_term'
  | 'document_frequency_mismatch'
  | 'partial_file'
  | 'invalid_metadata';

export interface IntegrityIssueRecord {
  type: IntegrityIssueType;
  description: string;
  details?: string;
}

export interface IntegrityReportRecord {
  healthy: boolean;
  issues: IntegrityIssueRecord[];
  repaired: boolean;
  /** Exact number of issues per type (the issue list itself is truncated). */
  summary?: Record<string, number>;
}

/** Issues listed individually per type; the summary still counts all of them. */
const MAX_DETAILED_ISSUES_PER_TYPE = 50;

/**
 * Verifies the invariants the indexer maintains. Each check describes a state
 * that must never exist after a committed transaction, so an empty, freshly
 * created database reports zero issues.
 */
export class IntegrityManager {
  constructor(private readonly explicitDatabase?: Database.Database) {}

  private get database(): Database.Database {
    return this.explicitDatabase ?? getDatabase();
  }

  verify(): IntegrityReportRecord {
    const schemaIssues = this.checkSchema();
    // Data checks rely on the schema; skip them if the schema is wrong.
    const allIssues =
      schemaIssues.length > 0
        ? schemaIssues
        : [
            ...this.checkMetadata(),
            ...this.checkForeignKeys(),
            ...this.checkOrphanPostings(),
            ...this.checkDocumentFrequencies(),
            ...this.checkPartialFiles(),
          ];

    const summary = summarize(allIssues);
    const healthy = allIssues.length === 0;
    getLogger().info(
      'index',
      'IntegrityManager',
      healthy
        ? 'Integrity verification complete: 0 issues'
        : `Integrity verification complete: ${allIssues.length} issue(s) ${JSON.stringify(summary)}`
    );
    return { healthy, issues: limitDetails(allIssues), repaired: false, summary };
  }

  verifyAndRepair(): IntegrityReportRecord {
    const report = this.verify();
    if (report.healthy) return report;

    let repaired = true;
    if (report.issues.some((i) => i.type === 'schema_mismatch')) {
      // A structurally incompatible schema cannot be repaired in place; the
      // connection layer rebuilds such databases when they are opened.
      repaired = false;
    } else {
      try {
        this.repairData();
      } catch (err) {
        repaired = false;
        getLogger().error(
          'index',
          'IntegrityManager',
          `Repair failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const finalReport = this.verify();
    return { ...finalReport, repaired: repaired && finalReport.healthy };
  }

  runPragmaIntegrityCheck(): { ok: boolean; message: string } {
    try {
      const message = String(this.database.pragma('integrity_check', { simple: true }));
      return { ok: message === 'ok', message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private checkSchema(): IntegrityIssueRecord[] {
    return validateSchema(this.database).problems.map((problem) => ({
      type: 'schema_mismatch' as const,
      description: `Schema is not compatible with version ${SCHEMA_VERSION}`,
      details: problem,
    }));
  }

  private checkMetadata(): IntegrityIssueRecord[] {
    const db = this.database;
    const issues: IntegrityIssueRecord[] = [];
    const rows = db.prepare('SELECT id FROM IndexMetadata').all() as { id: number }[];

    if (!rows.some((r) => r.id === 1)) {
      issues.push({ type: 'missing_metadata', description: 'IndexMetadata singleton row is missing' });
      return issues;
    }
    if (rows.length > 1) {
      issues.push({
        type: 'duplicate_metadata',
        description: `Found ${rows.length} IndexMetadata rows (expected 1)`,
      });
    }

    const meta = db
      .prepare('SELECT total_indexed_files, total_indexed_terms FROM IndexMetadata WHERE id = 1')
      .get() as { total_indexed_files: number; total_indexed_terms: number };
    const files = db.prepare('SELECT COUNT(*) AS count FROM Files').get() as { count: number };
    const terms = db.prepare('SELECT COUNT(*) AS count FROM Terms').get() as { count: number };

    if (meta.total_indexed_files !== files.count) {
      issues.push({
        type: 'invalid_metadata',
        description: 'Indexed file count does not match Files table',
        details: `metadata=${meta.total_indexed_files}, actual=${files.count}`,
      });
    }
    if (meta.total_indexed_terms !== terms.count) {
      issues.push({
        type: 'invalid_metadata',
        description: 'Indexed term count does not match Terms table',
        details: `metadata=${meta.total_indexed_terms}, actual=${terms.count}`,
      });
    }
    return issues;
  }

  private checkForeignKeys(): IntegrityIssueRecord[] {
    const rows = this.database.pragma('foreign_key_check') as {
      table: string;
      rowid: number | null;
      parent: string;
    }[];
    return rows.map((row) => ({
      type: 'foreign_key_violation' as const,
      description: `${row.table} row references a missing ${row.parent} row`,
      details: row.rowid !== null ? `rowid=${row.rowid}` : undefined,
    }));
  }

  private checkOrphanPostings(): IntegrityIssueRecord[] {
    const rows = this.database
      .prepare(
        `SELECT p.term_id, p.file_id
         FROM Postings p
         LEFT JOIN Files f ON f.id = p.file_id
         LEFT JOIN Terms t ON t.id = p.term_id
         WHERE f.id IS NULL OR t.id IS NULL`
      )
      .all() as { term_id: number; file_id: number }[];
    return rows.map((row) => ({
      type: 'orphan_posting' as const,
      description: 'Posting references a missing file or term',
      details: `term_id=${row.term_id}, file_id=${row.file_id}`,
    }));
  }

  /**
   * Terms.document_frequency must equal the number of postings for the term.
   * A term with no postings at all is reported as an orphan term.
   */
  private checkDocumentFrequencies(): IntegrityIssueRecord[] {
    const rows = this.database
      .prepare(
        `SELECT t.id, t.term, t.document_frequency AS df, COALESCE(p.count, 0) AS actual
         FROM Terms t
         LEFT JOIN (SELECT term_id, COUNT(*) AS count FROM Postings GROUP BY term_id) p
           ON p.term_id = t.id
         WHERE p.count IS NULL OR t.document_frequency != p.count`
      )
      .all() as { id: number; term: string; df: number; actual: number }[];

    return rows.map((row) =>
      row.actual === 0
        ? {
            type: 'orphan_term' as const,
            description: `Term "${row.term}" has no postings`,
            details: `term_id=${row.id}`,
          }
        : {
            type: 'document_frequency_mismatch' as const,
            description: `Term "${row.term}" has document_frequency ${row.df} but ${row.actual} posting(s)`,
            details: `term_id=${row.id}`,
          }
    );
  }

  /**
   * A file with a non-zero token count but no postings was only partially
   * written. Files with doc_length = 0 (empty documents) legitimately have no
   * postings and are not reported.
   */
  private checkPartialFiles(): IntegrityIssueRecord[] {
    const rows = this.database
      .prepare(
        `SELECT f.path FROM Files f
         WHERE f.doc_length > 0
           AND NOT EXISTS (SELECT 1 FROM Postings p WHERE p.file_id = f.id)`
      )
      .all() as { path: string }[];
    return rows.map((row) => ({
      type: 'partial_file' as const,
      description: 'File has content but no postings; it will be re-indexed',
      details: row.path,
    }));
  }

  private repairData(): void {
    const db = this.database;
    db.transaction(() => {
      db.prepare(
        `INSERT OR IGNORE INTO IndexMetadata (id, status, schema_version, created_at)
         VALUES (1, 'never_indexed', ?, ?)`
      ).run(SCHEMA_VERSION, Date.now());
      db.exec('DELETE FROM IndexMetadata WHERE id != 1');
      db.exec(`DELETE FROM Postings
               WHERE file_id NOT IN (SELECT id FROM Files)
                  OR term_id NOT IN (SELECT id FROM Terms)`);
      // Partial files are removed so the next sync indexes them from scratch.
      db.exec(`DELETE FROM Files
               WHERE doc_length > 0
                 AND NOT EXISTS (SELECT 1 FROM Postings p WHERE p.file_id = Files.id)`);
      db.exec(`UPDATE Terms SET document_frequency =
                 (SELECT COUNT(*) FROM Postings p WHERE p.term_id = Terms.id)`);
      db.exec('DELETE FROM Terms WHERE document_frequency = 0');
      db.exec(`UPDATE IndexMetadata SET
                 total_indexed_files = (SELECT COUNT(*) FROM Files),
                 total_indexed_terms = (SELECT COUNT(*) FROM Terms)
               WHERE id = 1`);
    })();
  }
}

function summarize(issues: IntegrityIssueRecord[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const issue of issues) {
    summary[issue.type] = (summary[issue.type] ?? 0) + 1;
  }
  return summary;
}

function limitDetails(issues: IntegrityIssueRecord[]): IntegrityIssueRecord[] {
  const shownPerType = new Map<string, number>();
  const result: IntegrityIssueRecord[] = [];
  for (const issue of issues) {
    const shown = shownPerType.get(issue.type) ?? 0;
    if (shown < MAX_DETAILED_ISSUES_PER_TYPE) result.push(issue);
    shownPerType.set(issue.type, shown + 1);
  }
  for (const [type, count] of shownPerType) {
    if (count > MAX_DETAILED_ISSUES_PER_TYPE) {
      result.push({
        type: type as IntegrityIssueType,
        description: `…and ${count - MAX_DETAILED_ISSUES_PER_TYPE} more ${type} issue(s)`,
      });
    }
  }
  return result;
}
