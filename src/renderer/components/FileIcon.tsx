import { memo, type ElementType } from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  Presentation,
} from 'lucide-react';
import { getExtension } from '../lib/path.js';

type Category = 'pdf' | 'doc' | 'sheet' | 'slide' | 'code' | 'web' | 'text' | 'image' | 'video' | 'audio' | 'archive';

const CATEGORY_BY_EXT: Record<string, Category> = {};
const register = (category: Category, exts: string[]) => exts.forEach((e) => (CATEGORY_BY_EXT[e] = category));
register('pdf', ['.pdf']);
register('doc', ['.doc', '.docx', '.odt', '.rtf', '.pages']);
register('sheet', ['.xls', '.xlsx', '.csv', '.ods', '.tsv']);
register('slide', ['.ppt', '.pptx', '.odp', '.key']);
register('web', ['.html', '.htm', '.xhtml', '.mhtml']);
register('text', ['.txt', '.md', '.markdown', '.log', '.rst', '.tex']);
register('code', [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.yml', '.yaml', '.css', '.scss', '.py', '.java',
  '.c', '.h', '.cpp', '.cs', '.go', '.rs', '.php', '.rb', '.sh', '.ps1', '.sql', '.kt', '.swift',
]);
register('image', ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico', '.heic']);
register('video', ['.mp4', '.mov', '.avi', '.mkv', '.webm']);
register('audio', ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);
register('archive', ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2']);

const ICONS: Record<Category, ElementType> = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation,
  code: FileCode,
  web: Globe,
  text: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
};

const HUES: Record<Category, string> = {
  pdf: 'var(--ft-pdf)',
  doc: 'var(--ft-doc)',
  sheet: 'var(--ft-sheet)',
  slide: 'var(--ft-slide)',
  code: 'var(--ft-code)',
  web: 'var(--ft-web)',
  text: 'var(--ft-text)',
  image: 'var(--ft-media)',
  video: 'var(--ft-media)',
  audio: 'var(--ft-media)',
  archive: 'var(--ft-archive)',
};

interface FileIconProps {
  filePath: string;
  /** Tile edge in px. */
  size?: number;
}

/** A tinted file-type tile: hue identifies the type, the glyph stays quiet. */
export const FileIcon = memo(function FileIcon({ filePath, size = 32 }: FileIconProps) {
  const ext = getExtension(filePath);
  const category = CATEGORY_BY_EXT[ext];
  const Icon = category ? ICONS[category] : File;
  const hue = category ? HUES[category] : 'var(--ft-text)';

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md"
      style={{
        width: size,
        height: size,
        color: hue,
        background: `color-mix(in srgb, ${hue} 13%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.75} />
    </span>
  );
});
