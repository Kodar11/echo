export function getExtension(filePath: string): string {
  const match = filePath.match(/\.[^.\\/]+$/);
  return match ? match[0].toLowerCase() : '';
}

export function getBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

export function getDirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return normalized.slice(0, lastSlash);
}
