import path from 'path';

/**
 * Path normalization used everywhere a path is stored or compared.
 *
 * Stored paths are absolute and resolved (no `..`, no trailing separator,
 * native separators) but keep the casing reported by the file system so they
 * can be displayed and opened as-is. Comparisons go through `pathKey`, which
 * folds case for Windows paths to match NTFS semantics.
 */

export function normalizeFsPath(input: string): string {
  return path.resolve(input);
}

export function pathKey(input: string, platformPath: typeof path = path): string {
  const normalized = platformPath.resolve(input);
  return platformPath.sep === '\\' ? normalized.toLowerCase() : normalized;
}

/**
 * True when `child` is `parent` itself or lies beneath it, respecting path
 * boundaries: `C:\foo\bar` contains `C:\foo\bar\a.txt` but not
 * `C:\foo\bar2\a.txt`.
 */
export function isPathInside(
  child: string,
  parent: string,
  platformPath: typeof path = path
): boolean {
  const childKey = pathKey(child, platformPath);
  const parentKey = pathKey(parent, platformPath);
  if (childKey === parentKey) return true;
  const relative = platformPath.relative(parentKey, childKey);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${platformPath.sep}`) &&
    !platformPath.isAbsolute(relative)
  );
}

export function isInsideAny(
  child: string,
  parents: string[],
  platformPath: typeof path = path
): boolean {
  return parents.some((parent) => isPathInside(child, parent, platformPath));
}

/** Dot-prefixed names are treated as hidden on every platform. */
export function isHiddenName(name: string): boolean {
  return name.startsWith('.') && name !== '.' && name !== '..';
}

/** True if any segment of `filePath` below `root` is hidden. */
export function hasHiddenSegment(filePath: string, root?: string): boolean {
  const relative = root ? path.relative(root, filePath) : filePath;
  return relative.split(/[\\/]+/).some(isHiddenName);
}
