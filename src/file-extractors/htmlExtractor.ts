import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { FileExtractor, normalizeText } from './extractor.js';

export const htmlExtractor: FileExtractor = {
  extensions: ['.html', '.htm'],
  async extract(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const html = buffer.toString('utf-8');
    const $ = cheerio.load(html);
    $('script, style, nav, footer').remove();
    const text = $('body').text();
    return normalizeText(text);
  },
};
