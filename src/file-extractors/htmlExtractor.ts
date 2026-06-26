import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import {
  FileExtractor,
  normalizeText,
  parseDateToTimestamp,
} from './extractor.js';

export const htmlExtractor: FileExtractor = {
  extensions: ['.html', '.htm'],
  async extract(filePath: string) {
    const buffer = await fs.readFile(filePath);
    const html = buffer.toString('utf-8');
    const $ = cheerio.load(html);

    $('script, style, nav, footer').remove();
    const text = normalizeText($('body').text());

    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[name="Author"]').attr('content') ||
      undefined;

    const createdAt = parseDateToTimestamp(
      $('meta[name="date"]').attr('content') ??
        $('meta[name="DC.date"]').attr('content')
    );

    return { text, author, createdAt };
  },
};
