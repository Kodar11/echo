import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExtractorManager } from './ExtractorManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';

describe('ExtractorManager', () => {
  let dbInfo: { dbPath: string };
  let manager: ExtractorManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new ExtractorManager();
    manager.initialize();
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('enables all extractors by default', () => {
    const enabled = manager.getEnabled();
    expect(enabled).toContain('pdf');
    expect(enabled).toContain('docx');
    expect(enabled).toContain('html');
    expect(enabled).toContain('markdown');
    expect(enabled).toContain('text');
  });

  it('returns available extractors', () => {
    const available = manager.getAvailable();
    expect(available.map((e) => e.id).sort()).toEqual([
      'docx',
      'html',
      'markdown',
      'pdf',
      'text',
    ]);
  });

  it('disables unsupported files when extractors are turned off', () => {
    manager.setEnabled(['text']);
    expect(manager.isSupportedFile('document.pdf')).toBe(false);
    expect(manager.isSupportedFile('notes.txt')).toBe(true);
  });

  it('returns the correct extractor for enabled file types', () => {
    const extractor = manager.getExtractor('report.pdf');
    expect(extractor).toBeDefined();
    expect(extractor?.extensions).toContain('.pdf');
  });

  it('persists enabled extractors across initializations', () => {
    manager.setEnabled(['pdf', 'text']);

    const second = new ExtractorManager();
    second.initialize();
    expect(second.getEnabled().sort()).toEqual(['pdf', 'text']);
  });
});
