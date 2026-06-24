import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { FileExtractor, normalizeText } from './extractor.js';

export const pdfExtractor: FileExtractor = {
  extensions: ['.pdf'],
  async extract(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return normalizeText(result.text);
  },
};
