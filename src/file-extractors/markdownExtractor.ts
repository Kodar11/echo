import fs from 'fs/promises';
import { FileExtractor, normalizeText } from './extractor.js';

export const markdownExtractor: FileExtractor = {
  extensions: ['.md'],
  async extract(filePath: string) {
    const buffer = await fs.readFile(filePath);
    return { text: normalizeText(buffer.toString('utf-8')) };
  },
};
