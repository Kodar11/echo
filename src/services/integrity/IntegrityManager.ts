import type Database from 'better-sqlite3';
import { getLogger } from '../logger/logger.js';

export class IntegrityManager {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  verify(): IntegrityReport {
    getLogger().info('index', 'IntegrityManager', 'Starting integrity verification');

    const issues: IntegrityIssue[] = [
      ...this.findOrphanTerms(),
      ...this.findOrphanPostings(),
      ...this.findMissingFiles(),
      ...this.findDuplicateMetadata(),
      ...this.findInvalidMetadata(),
    ];

    const healthy = issues.length === 0;

    getLogger().info(
      'index',
      'IntegrityManager',
      `Integrity verification complete: ${issues.length} issue(s) found`
    );

    return { healthy, issues, repaired: false };
  }

  verifyAndRepair(): IntegrityReport {
    const report = this.verify();
    if (report.healthy) return report;

    getLogger().info(
      'index',
      'IntegrityManager',
      `Repairing ${report.issues.length} integrity issue(s)`
    );

    const repaired = this.repair(report.issues);

    getLogger().info(
      'index',
      'IntegrityManager',
      repaired ? 'Repair completed successfully' : 'Repair completed with remaining issues'
    );

    return { healthy: false, issues: report.issues, repaired };
  }

  runPragmaIntegrityCheck(): { ok: boolean; message: string } {
    try {
      const message = getIntegrityCheckMessage(this.database.pragma('integrity_check'));
      return { ok: message === 'ok', message };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private findOrphanTerms(): IntegrityIssue[] {
    const rows = this.database
      .prepare(
        `SELECT t.id, t.term
         FROM Terms t
         LEFT JOIN Postings p ON p.term_id = t.id
         GROUP BY t.id
         HAVING COUNT(p.file_id) = 0`
      )
      .all() as { id: number; term: string }[];

    return rows.map((row) => ({
      type: 'orphan_term' as const,
      description: `Term "${row.term}" has no postings`,
      details: `term_id=${row.id}`,
    }));
  }

  private findOrphanPostings(): IntegrityIssue[] {
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
      description: 'Posting references missing file or term',
      details: `term_id=${row.term_id}, file_id=${row.file_id}`,
    }));
  }

  private findMissingFiles(): IntegrityIssue[] {
    const rows = this.database
      .prepare(
        `SELECT f.path
         FROM Files f
         LEFT JOIN Postings p ON p.file_id = f.id
         GROUP BY f.id
         HAVING COUNT(p.term_id) = 0`
      )
      .all() as { path: string }[];

    return rows.map((row) => ({
      type: 'missing_file' as const,
      description: 'File has no postings and will need re-indexing',
      details: row.path,
    }));
  }

  private findDuplicateMetadata(): IntegrityIssue[] {
    const count = this.database
      .prepare('SELECT COUNT(*) as count FROM IndexMetadata')
      .get() as { count: number };

    if (count.count <= 1) return [];

    return [
      {
        type: 'duplicate_metadata' as const,
        description: `Found ${count.count} IndexMetadata rows (expected 1)`,
      },
    ];
  }

  private findInvalidMetadata(): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];
    const metadata = this.database
      .prepare('SELECT * FROM IndexMetadata WHERE id = 1')
      .get() as
      | {
          total_indexed_files: number;
          total_indexed_terms: number;
        }
      | undefined;

    if (!metadata) return issues;

    const actualFiles = this.database
      .prepare('SELECT COUNT(*) as count FROM Files')
      .get() as { count: number };
    const actualTerms = this.database
      .prepare('SELECT COUNT(*) as count FROM Terms')
      .get() as { count: number };

    if (metadata.total_indexed_files !== actualFiles.count) {
      issues.push({
        type: 'invalid_metadata' as const,
        description: 'Indexed file count does not match Files table',
        details: `metadata=${metadata.total_indexed_files}, actual=${actualFiles.count}`,
      });
    }

    if (metadata.total_indexed_terms !== actualTerms.count) {
      issues.push({
        type: 'invalid_metadata' as const,
        description: 'Indexed term count does not match Terms table',
        details: `metadata=${metadata.total_indexed_terms}, actual=${actualTerms.count}`,
      });
    }

    return issues;
  }

  private repair(issues: IntegrityIssue[]): boolean {
    let success = true;

    const transaction = this.database.transaction(() => {
      for (const issue of issues) {
        try {
          switch (issue.type) {
            case 'orphan_term':
              this.database.exec(
                `DELETE FROM Terms WHERE id IN (
                   SELECT t.id FROM Terms t
                   LEFT JOIN Postings p ON p.term_id = t.id
                   GROUP BY t.id
                   HAVING COUNT(p.file_id) = 0
                 )`
              );
              break;
            case 'orphan_posting':
              this.database.exec(
                `DELETE FROM Postings WHERE file_id NOT IN (SELECT id FROM Files)
                   OR term_id NOT IN (SELECT id FROM Terms)`
              );
              break;
            case 'missing_file':
              // Missing-file entries are left in place so the indexer can retry them.
              break;
            case 'duplicate_metadata':
              this.database.exec(
                'DELETE FROM IndexMetadata WHERE id != 1'
              );
              break;
            case 'invalid_metadata':
              this.reconcileMetadataCounters();
              break;
          }
        } catch (err) {
          success = false;
          getLogger().error(
            'index',
            'IntegrityManager',
            `Repair failed for ${issue.type}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    });

    transaction();
    return success;
  }

  private reconcileMetadataCounters(): void {
    const fileCount = this.database
      .prepare('SELECT COUNT(*) as count FROM Files')
      .get() as { count: number };
    const termCount = this.database
      .prepare('SELECT COUNT(*) as count FROM Terms')
      .get() as { count: number };

    this.database
      .prepare(
        `UPDATE IndexMetadata
         SET total_indexed_files = ?, total_indexed_terms = ?
         WHERE id = 1`
      )
      .run(fileCount.count, termCount.count);
  }
}

function getIntegrityCheckMessage(result: unknown): string {
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (first && typeof first === 'object' && 'integrity_check' in first) {
      return (first as { integrity_check: string }).integrity_check;
    }
  }
  if (result && typeof result === 'object' && 'integrity_check' in result) {
    return (result as { integrity_check: string }).integrity_check;
  }
  return String(result);
}
