import mammoth from 'mammoth';
import { FileExtractor, normalizeText } from './extractor.js';

export const docxExtractor: FileExtractor = {
  extensions: ['.docx'],
  async extract(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return normalizeText(result.value);
  },
};
