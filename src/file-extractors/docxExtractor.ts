import fs from 'fs/promises';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  FileExtractor,
  normalizeText,
  parseDateToTimestamp,
} from './extractor.js';

async function readDocxCoreProps(
  buffer: Buffer
): Promise<{ author?: string; createdAt?: number }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const coreXml = await zip.file('docProps/core.xml')?.async('string');
    if (!coreXml) return {};

    const authorMatch = coreXml.match(/<dc:creator>([^<]*)<\/dc:creator>/);
    const createdMatch = coreXml.match(/<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/);

    return {
      author: authorMatch?.[1]?.trim() || undefined,
      createdAt: parseDateToTimestamp(createdMatch?.[1]),
    };
  } catch {
    // Metadata is optional; text extraction reports real problems.
    return {};
  }
}

export const docxExtractor: FileExtractor = {
  extensions: ['.docx'],
  async extract(filePath: string) {
    // Read once; both parsers work on the same buffer, so no file handle is
    // left open if one of them fails.
    const buffer = await fs.readFile(filePath);
    const textResult = await mammoth.extractRawText({ buffer });
    const metadata = await readDocxCoreProps(buffer);

    return {
      text: normalizeText(textResult.value),
      ...metadata,
    };
  },
};
