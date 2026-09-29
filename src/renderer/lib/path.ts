export function getExtension(filePath: string): string {
  const match = filePath.match(/\.[^.\\/]+$/);
  return match ? match[0].toLowerCase() : '';
}

export function getBasename(filePath: string): string {
  const parts = filePath.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

/** Parent directory, keeping the path's own separators. */
export function getDirname(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep === -1 ? '' : filePath.slice(0, lastSep);
}

function normalize(value: string): string {
  return value.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
}

/**
 * Breadcrumb segments for a file's directory, relative to the library folder
 * that contains it ("Documents › CS › System Design"). Falls back to the
 * trailing segments of the absolute path.
 */
export function getBreadcrumb(filePath: string, roots: readonly string[]): string[] {
  const dir = getDirname(filePath).replace(/\\/g, '/');
  const normalizedDir = normalize(dir);
  let best: string | null = null;
  for (const root of roots) {
    const r = normalize(root);
    if ((normalizedDir === r || normalizedDir.startsWith(`${r}/`)) && (!best || r.length > normalize(best).length)) {
      best = root;
    }
  }
  const segments = dir.split('/').filter(Boolean);
  if (!best) return segments.slice(-4);
  const rootDepth = normalize(best).split('/').filter(Boolean).length;
  return [getBasename(best), ...segments.slice(rootDepth)];
}
