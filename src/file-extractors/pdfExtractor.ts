import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import {
  FileExtractor,
  normalizeText,
  parseDateToTimestamp,
} from './extractor.js';

export const pdfExtractor: FileExtractor = {
  extensions: ['.pdf'],
  async extract(filePath: string) {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });

    // getText and getInfo must run sequentially; pdfjs-dist cannot handle
    // concurrent operations on the same parser instance.
    const textResult = await parser.getText();

    let author: string | undefined;
    let createdAt: number | undefined;
    try {
      const infoResult = await parser.getInfo();
      const info = infoResult?.info ?? {};
      author = typeof info.Author === 'string' ? info.Author : undefined;
      createdAt =
        parseDateToTimestamp(info.CreationDate) ??
        parseDateToTimestamp(info.CreationDate?.toString()) ??
        infoResult?.getDateNode?.().CreationDate?.getTime() ??
        undefined;
    } catch (err) {
      console.warn(`Failed to read PDF metadata for ${filePath}:`, err);
    }

    await parser.destroy();

    return {
      text: normalizeText(textResult.text),
      author,
      createdAt,
    };
  },
};
