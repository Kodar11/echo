export interface FileExtractor {
  extensions: string[];
  extract(filePath: string): Promise<string>;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}
