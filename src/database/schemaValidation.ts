import Database from 'better-sqlite3';
import { REQUIRED_TABLES, SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';

export interface SchemaValidationResult {
  compatible: boolean;
  problems: string[];
}

type SchemaShape = Map<string, Set<string>>;

let canonicalShape: SchemaShape | null = null;

/**
 * The shape (tables -> columns) produced by the canonical SCHEMA_SQL. Computed
 * once from an in-memory database so validation can never drift from the
 * schema definition.
 */
function getCanonicalShape(): SchemaShape {
  if (canonicalShape) return canonicalShape;
  const reference = new Database(':memory:');
  try {
    reference.exec(SCHEMA_SQL);
    canonicalShape = readShape(reference);
  } finally {
    reference.close();
  }
  return canonicalShape;
}

function readShape(database: Database.Database): SchemaShape {
  const shape: SchemaShape = new Map();
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as { name: string }[];
  for (const { name } of tables) {
    const columns = database
      .prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`)
      .all() as { name: string }[];
    shape.set(name, new Set(columns.map((c) => c.name)));
  }
  return shape;
}

export function hasUserTables(database: Database.Database): boolean {
  const row = database
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    .get() as { count: number };
  return row.count > 0;
}

export function getUserVersion(database: Database.Database): number {
  return Number(database.pragma('user_version', { simple: true }) ?? 0);
}

/**
 * Checks whether the database really has the shape the current code expects.
 * This inspects the actual tables/columns rather than trusting migration
 * bookkeeping, so a database that claims a migration ran but is missing
 * columns is reported as incompatible.
 */
export function validateSchema(database: Database.Database): SchemaValidationResult {
  const problems: string[] = [];

  const version = getUserVersion(database);
  if (version !== SCHEMA_VERSION) {
    problems.push(`schema version is ${version}, expected ${SCHEMA_VERSION}`);
  }

  const expected = getCanonicalShape();
  const actual = readShape(database);

  for (const table of REQUIRED_TABLES) {
    const expectedColumns = expected.get(table);
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      problems.push(`missing table ${table}`);
      continue;
    }
    for (const column of expectedColumns ?? []) {
      if (!actualColumns.has(column)) {
        problems.push(`missing column ${table}.${column}`);
      }
    }
  }

  if (actual.has('Migrations')) {
    const row = database
      .prepare('SELECT MAX(version) AS version FROM Migrations')
      .get() as { version: number | null };
    if ((row.version ?? 0) !== version) {
      problems.push(
        `Migrations table records version ${row.version ?? 0} but schema version is ${version}`
      );
    }
  }

  return { compatible: problems.length === 0, problems };
}
