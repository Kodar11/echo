import type Database from 'better-sqlite3';
import { getLogger } from '../logger/logger.js';

export class MaintenanceManager {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  runMaintenance(options: { vacuum?: boolean; analyze?: boolean } = {}): MaintenanceResult {
    const operations: MaintenanceOperation[] = [];

    operations.push(this.runIntegrityCheck());
    operations.push(this.runOptimize());

    if (options.analyze !== false) {
      operations.push(this.runAnalyze());
    }

    if (options.vacuum) {
      operations.push(this.runVacuum());
    }

    operations.push(this.runWalCheckpoint());

    const success = operations.every((op) => op.success);

    getLogger().info(
      'index',
      'MaintenanceManager',
      `Maintenance complete: ${operations.filter((o) => o.success).length}/${operations.length} operations succeeded`
    );

    return { success, operations };
  }

  private runIntegrityCheck(): MaintenanceOperation {
    const start = Date.now();
    try {
      const message = getIntegrityCheckMessage(this.database.pragma('integrity_check'));
      const success = message === 'ok';
      return {
        name: 'integrity_check',
        success,
        durationMs: Date.now() - start,
        message,
      };
    } catch (err) {
      return {
        name: 'integrity_check',
        success: false,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private runOptimize(): MaintenanceOperation {
    const start = Date.now();
    try {
      this.database.exec('PRAGMA optimize');
      return {
        name: 'optimize',
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: 'optimize',
        success: false,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private runAnalyze(): MaintenanceOperation {
    const start = Date.now();
    try {
      this.database.exec('ANALYZE');
      return {
        name: 'analyze',
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: 'analyze',
        success: false,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private runVacuum(): MaintenanceOperation {
    const start = Date.now();
    try {
      this.database.exec('VACUUM');
      return {
        name: 'vacuum',
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: 'vacuum',
        success: false,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private runWalCheckpoint(): MaintenanceOperation {
    const start = Date.now();
    try {
      this.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      return {
        name: 'wal_checkpoint',
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: 'wal_checkpoint',
        success: false,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function getIntegrityCheckMessage(
  result: unknown
): string {
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
