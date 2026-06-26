import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  FileExtractor,
  normalizeText,
  parseDateToTimestamp,
} from './extractor.js';

async function readDocxCoreProps(
  filePath: string
): Promise<{ author?: string; createdAt?: number }> {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const coreXml = await zip.file('docProps/core.xml')?.async('string');
    if (!coreXml) return {};

    const authorMatch = coreXml.match(
      /<dc:creator>([^<]*)<\/dc:creator>/
    );
    const createdMatch = coreXml.match(
      /<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/
    );

    return {
      author: authorMatch?.[1]?.trim() || undefined,
      createdAt: parseDateToTimestamp(createdMatch?.[1]),
    };
  } catch (err) {
    console.error(`Failed to read DOCX metadata for ${filePath}:`, err);
    return {};
  }
}

export const docxExtractor: FileExtractor = {
  extensions: ['.docx'],
  async extract(filePath: string) {
    const [textResult, metadata] = await Promise.all([
      mammoth.extractRawText({ path: filePath }),
      readDocxCoreProps(filePath),
    ]);

    return {
      text: normalizeText(textResult.value),
      ...metadata,
    };
  },
};
