import type { ElementType } from 'react';
import {
  File,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  FolderArchive,
} from 'lucide-react';
import { getExtension } from '../lib/path.js';

interface FileIconProps {
  filePath: string;
  size?: number;
  className?: string;
}

const ICON_MAP: Record<string, ElementType> = {
  text: FileText,
  code: FileCode,
  pdf: FileType,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  spreadsheet: FileSpreadsheet,
  archive: FolderArchive,
};

function getFileCategory(ext: string): string {
  if (['.txt', '.md', '.docx', '.doc', '.rtf'].includes(ext)) return 'text';
  if (['.html', '.htm', '.xml', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb'].includes(ext))
    return 'code';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(ext))
    return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'spreadsheet';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) return 'archive';
  return 'default';
}

export function FileIcon({ filePath, size = 18, className = '' }: FileIconProps) {
  const ext = getExtension(filePath);
  const category = getFileCategory(ext);
  const Icon = ICON_MAP[category] ?? File;

  return <Icon size={size} strokeWidth={1.6} className={className} />;
}
