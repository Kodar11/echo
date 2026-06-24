import fs from 'fs/promises';
import { FileExtractor, normalizeText } from './extractor.js';

export const textExtractor: FileExtractor = {
  extensions: ['.txt'],
  async extract(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return normalizeText(buffer.toString('utf-8'));
  },
};
