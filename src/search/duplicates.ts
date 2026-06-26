import type { FileRecord } from '../database/files.js';
import { getDuplicateFileGroups as getDbDuplicateGroups } from '../database/files.js';

export interface DuplicateGroup {
  hash: string;
  files: Array<{
    id: number;
    path: string;
    size: number;
    modifiedTime: number;
  }>;
  count: number;
  totalSize: number;
  wastedSpace: number;
}

export function findDuplicateGroups(): DuplicateGroup[] {
  const groups = getDbDuplicateGroups();
  return groups.map((files) => {
    const hash = files[0]?.content_hash ?? '';
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const wastedSpace = totalSize - Math.max(...files.map((f) => f.size));
    return {
      hash,
      files: files
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((f) => ({
          id: f.id,
          path: f.path,
          size: f.size,
          modifiedTime: f.modified_time,
        })),
      count: files.length,
      totalSize,
      wastedSpace: Math.max(0, wastedSpace),
    };
  });
}
