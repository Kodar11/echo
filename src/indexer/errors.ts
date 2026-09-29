import type { FailureCategory } from '../database/indexingFailures.js';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** File-system errors meaning the path no longer exists. */
export function isNotFoundError(err: unknown): boolean {
  const code = errorCode(err);
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * Maps an error from reading or extracting a file to a failure category.
 * System error codes are authoritative; message matching is only a fallback
 * for extractor libraries that throw plain Errors.
 */
export function categorizeError(err: unknown, stage: 'read' | 'extract' = 'extract'): FailureCategory {
  switch (errorCode(err)) {
    case 'EACCES':
    case 'EPERM':
      return 'permission_denied';
    case 'ENOENT':
    case 'ENOTDIR':
      return 'not_found';
    case 'EBUSY':
    case 'ELOCKED':
      return 'locked';
    case 'EIO':
    case 'EISDIR':
    case 'EMFILE':
    case 'ENFILE':
      return 'read_error';
    case 'SQLITE_ERROR':
    case 'SQLITE_BUSY':
    case 'SQLITE_FULL':
    case 'SQLITE_CORRUPT':
    case 'SQLITE_IOERR':
    case 'SQLITE_CONSTRAINT':
      return 'database_error';
  }

  const lower = errorMessage(err).toLowerCase();
  if (lower.includes('permission') || lower.includes('access denied')) return 'permission_denied';
  if (lower.includes('password') || lower.includes('encrypt')) return 'encrypted';
  if (lower.includes('locked') || lower.includes('resource busy')) return 'locked';
  if (
    lower.includes('corrupt') ||
    lower.includes('invalid') ||
    lower.includes('malformed') ||
    lower.includes('unable to deserialize') ||
    lower.includes('end of central directory')
  ) {
    return 'corrupted';
  }
  return stage === 'read' ? 'read_error' : 'extraction_failed';
}
