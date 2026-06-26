import type Database from 'better-sqlite3';
import { getBooleanSetting } from '../../database/settings.js';
import { SETTING_KEYS } from '../../settings/keys.js';
import { getLogger } from '../logger/logger.js';

export interface TransactionOptions {
  name?: string;
}

export class TransactionManager {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  run<T>(fn: () => T, options: TransactionOptions = {}): T {
    const name = options.name ?? 'unnamed';
    const logTransactions = getBooleanSetting(SETTING_KEYS.transactionLogging, false);

    if (logTransactions) {
      getLogger().debug('index', 'TransactionManager', `Begin transaction: ${name}`);
    }

    const transaction = this.database.transaction(fn);

    try {
      const result = transaction();
      if (logTransactions) {
        getLogger().debug('index', 'TransactionManager', `Commit transaction: ${name}`);
      }
      return result;
    } catch (err) {
      getLogger().error(
        'index',
        'TransactionManager',
        `Rollback transaction: ${name} — ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }
}
