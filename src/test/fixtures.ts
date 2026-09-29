import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { getDatabase } from '../database/connection.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { ignoreRuleManager } from '../services/ignore/IgnoreRuleManager.js';
import { setupTestDatabase, teardownTestDatabase } from './testDb.js';

export interface TestEnvironment {
  dbPath: string;
  root: string;
  file: (relative: string, content: string | Buffer, mtime?: Date) => string;
  cleanup: () => void;
}

/** Fresh database + a temporary folder to index. */
export function createTestEnvironment(): TestEnvironment {
  const { dbPath } = setupTestDatabase();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-fixture-'));
  extractorManager.initialize();
  ignoreRuleManager.initialize();

  return {
    dbPath,
    root,
    file(relative, content, mtime) {
      const full = path.join(root, relative);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
      if (mtime) fs.utimesSync(full, mtime, mtime);
      return full;
    },
    cleanup() {
      teardownTestDatabase(dbPath);
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    },
  };
}

export function count(table: string): number {
  return (getDatabase().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

/** Terms.document_frequency must equal the postings count for every term. */
export function documentFrequencyMismatches(): number {
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS c FROM Terms t
       WHERE t.document_frequency != (SELECT COUNT(*) FROM Postings p WHERE p.term_id = t.id)`
    )
    .get() as { c: number };
  return row.c;
}

export function createPdf(filePath: string, text: string): void {
  const stream = `BT\n/F1 12 Tf\n100 700 Td\n(${text}) Tj\nET\n`;
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>
endobj
4 0 obj
<< /Length ${stream.length} >>
stream
${stream}endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000284 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
435
%%EOF
`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, pdf);
}

export function createDocx(filePath: string, text: string): void {
  const zip = new AdmZip();
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)
  );
  zip.addFile(
    '_rels/.rels',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)
  );
  zip.addFile(
    'word/_rels/document.xml.rels',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`)
  );
  zip.addFile(
    'word/document.xml',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`)
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  zip.writeZip(filePath);
}

/** A promise with its resolver exposed, for pausing work deterministically. */
export function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
