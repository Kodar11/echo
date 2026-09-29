import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { setupTestDatabase, teardownTestDatabase } from '../test/testDb.js';
import { getDatabase } from '../database/connection.js';
import { addFolder } from '../database/folders.js';
import { IndexingCoordinator } from './IndexingCoordinator.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { ignoreRuleManager } from '../services/ignore/IgnoreRuleManager.js';
import { searchEngine } from '../search/engine.js';

/** Runs a full sync session to completion (the search index is rebuilt in finalization). */
async function runSync(coordinator: IndexingCoordinator): Promise<void> {
  const result = await coordinator.requestFullSync('manual');
  expect(result.outcome).toBe('completed');
}

function createPdf(filePath: string, text: string): void {
  // Minimal PDF that pdf-parse tolerates. Length field is approximate but the
  // parser extracts the text regardless for these small test files.
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
<< /Length 52 >>
stream
BT
/F1 12 Tf
100 700 Td
(${text}) Tj
ET
endstream
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
  fs.writeFileSync(filePath, pdf);
}

function createDocx(filePath: string, text: string): void {
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
  <w:body>
    <w:p>
      <w:r>
        <w:t>${text}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`)
  );

  zip.writeZip(filePath);
}

describe('Minimal indexing pipeline', () => {
  let dbInfo: { dbPath: string };
  let testDir: string;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-pipeline-test-'));
    extractorManager.initialize();
    ignoreRuleManager.initialize();
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('indexes a single TXT file and makes it searchable', async () => {
    const filePath = path.join(testDir, 'hello.txt');
    fs.writeFileSync(
      filePath,
      'Echo is a local desktop search engine.\nDatabase indexing should work correctly.\n'
    );

    addFolder(testDir);
    const queue = new IndexingCoordinator();
    await runSync(queue);

    const db = getDatabase();
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM Files').get() as {
      count: number;
    };
    const termCount = db.prepare('SELECT COUNT(*) as count FROM Terms').get() as {
      count: number;
    };
    const postingCount = db.prepare('SELECT COUNT(*) as count FROM Postings').get() as {
      count: number;
    };

    expect(fileCount.count).toBe(1);
    expect(termCount.count).toBeGreaterThan(0);
    expect(postingCount.count).toBeGreaterThan(0);

    const response = await searchEngine.search({ query: 'database' });
    expect(response.totalCount).toBe(1);
    expect(response.results[0].filename).toBe('hello.txt');
    expect(response.results[0].snippets.some((s) => s.toLowerCase().includes('database'))).toBe(
      true
    );
  });

  it('handles file modification, deletion, and recreation', async () => {
    const filePath = path.join(testDir, 'hello.txt');
    fs.writeFileSync(filePath, 'First version of the file.\n');
    addFolder(testDir);

    const queue = new IndexingCoordinator();
    await runSync(queue);

    let response = await searchEngine.search({ query: 'first' });
    expect(response.totalCount).toBe(1);

    fs.writeFileSync(filePath, 'Second version with modified content.\n');
    await runSync(queue);

    response = await searchEngine.search({ query: 'modified' });
    expect(response.totalCount).toBe(1);

    response = await searchEngine.search({ query: 'first' });
    expect(response.totalCount).toBe(0);

    fs.unlinkSync(filePath);
    await runSync(queue);

    response = await searchEngine.search({ query: 'second' });
    expect(response.totalCount).toBe(0);

    fs.writeFileSync(filePath, 'Third version after recreation.\n');
    await runSync(queue);

    response = await searchEngine.search({ query: 'recreation' });
    expect(response.totalCount).toBe(1);
  });

  it.each([
    { ext: 'md', query: 'markdown', text: 'Markdown indexing works.', factory: fs.writeFileSync },
    {
      ext: 'html',
      query: 'html',
      text: '<html><body>HTML indexing works.</body></html>',
      factory: fs.writeFileSync,
    },
    {
      ext: 'pdf',
      query: 'pdf',
      text: 'PDF indexing works',
      factory: createPdf,
    },
    {
      ext: 'docx',
      query: 'docx',
      text: 'DOCX indexing works',
      factory: createDocx,
    },
  ])('indexes a $ext file and makes it searchable', async ({ ext, query, text, factory }) => {
    const filePath = path.join(testDir, `sample.${ext}`);
    if (factory === fs.writeFileSync) {
      fs.writeFileSync(filePath, text);
    } else {
      factory(filePath, text);
    }

    addFolder(testDir);
    const queue = new IndexingCoordinator();
    await runSync(queue);

    const db = getDatabase();
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM Files').get() as {
      count: number;
    };
    expect(fileCount.count).toBe(1);

    const response = await searchEngine.search({ query });
    expect(response.totalCount).toBe(1);
    expect(response.results[0].filename).toBe(`sample.${ext}`);
  });
});
