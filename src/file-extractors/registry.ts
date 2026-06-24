import path from 'path';
import { FileExtractor } from './extractor.js';
import { textExtractor } from './textExtractor.js';
import { markdownExtractor } from './markdownExtractor.js';
import { pdfExtractor } from './pdfExtractor.js';
import { docxExtractor } from './docxExtractor.js';
import { htmlExtractor } from './htmlExtractor.js';

const extractors: FileExtractor[] = [
  textExtractor,
  markdownExtractor,
  pdfExtractor,
  docxExtractor,
  htmlExtractor,
];

const extensionToExtractor = new Map<string, FileExtractor>();
for (const extractor of extractors) {
  for (const ext of extractor.extensions) {
    extensionToExtractor.set(ext.toLowerCase(), extractor);
  }
}

export const SUPPORTED_EXTENSIONS = Array.from(extensionToExtractor.keys());

export function getExtractor(filePath: string): FileExtractor | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return extensionToExtractor.get(ext);
}

export function isSupportedFile(filePath: string): boolean {
  return getExtractor(filePath) !== undefined;
}
