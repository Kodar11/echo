export interface ExtractedContent {
  text: string;
  author?: string;
  createdAt?: number;
}

export interface FileExtractor {
  extensions: string[];
  extract(filePath: string): Promise<ExtractedContent>;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

export function parseDateToTimestamp(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value as string | number | Date);
  if (isNaN(date.getTime())) return undefined;
  return date.getTime();
}
