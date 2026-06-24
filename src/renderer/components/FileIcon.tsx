import {
  File,
  FileCode,
  FileImage,
  FileText,
  FileType,
} from 'lucide-react';
import { getExtension } from '../lib/path.js';

interface FileIconProps {
  filePath: string;
  size?: number;
  className?: string;
}

export function FileIcon({ filePath, size = 18, className = '' }: FileIconProps) {
  const ext = getExtension(filePath);

  let Icon = File;
  if (['.txt', '.md', '.docx'].includes(ext)) {
    Icon = FileText;
  } else if (['.html', '.htm', '.xml', '.json'].includes(ext)) {
    Icon = FileCode;
  } else if (['.pdf'].includes(ext)) {
    Icon = FileType;
  } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    Icon = FileImage;
  }

  return <Icon size={size} strokeWidth={1.6} className={className} />;
}
