import type Database from 'better-sqlite3';

/**
 * Legacy column migrations are now handled by MigrationManager.
 * This function is kept for compatibility but should be a no-op.
 */
export function runMigrations(_database: Database.Database): void {
  // Migrations are applied sequentially by src/services/migration/MigrationManager.
}
