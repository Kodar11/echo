import type { FileExtractor } from '../../file-extractors/extractor.js';
import { docxExtractor } from '../../file-extractors/docxExtractor.js';
import { htmlExtractor } from '../../file-extractors/htmlExtractor.js';
import { markdownExtractor } from '../../file-extractors/markdownExtractor.js';
import { pdfExtractor } from '../../file-extractors/pdfExtractor.js';
import { textExtractor } from '../../file-extractors/textExtractor.js';
import { getSetting, setSetting } from '../../database/settings.js';
import { SETTING_KEYS } from '../../settings/keys.js';

export type ExtractorId = 'pdf' | 'docx' | 'html' | 'markdown' | 'text';

interface ExtractorEntry {
  id: ExtractorId;
  label: string;
  extractor: FileExtractor;
}

const EXTRACTORS: ExtractorEntry[] = [
  { id: 'pdf', label: 'PDF', extractor: pdfExtractor },
  { id: 'docx', label: 'DOCX', extractor: docxExtractor },
  { id: 'html', label: 'HTML', extractor: htmlExtractor },
  { id: 'markdown', label: 'Markdown', extractor: markdownExtractor },
  { id: 'text', label: 'Text', extractor: textExtractor },
];

const DEFAULT_ENABLED: ExtractorId[] = ['pdf', 'docx', 'html', 'markdown', 'text'];

export class ExtractorManager {
  private enabledIds: Set<ExtractorId> = new Set(DEFAULT_ENABLED);
  private extensionToExtractor: Map<string, FileExtractor> = new Map();

  initialize(): void {
    this.loadEnabled();
    this.rebuildMap();
  }

  private loadEnabled(): void {
    const raw = getSetting(SETTING_KEYS.enabledExtractors);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ExtractorId[];
        this.enabledIds = new Set(parsed.filter((id) => EXTRACTORS.some((e) => e.id === id)));
        return;
      } catch {
        // fall through to default
      }
    }
    this.enabledIds = new Set(DEFAULT_ENABLED);
  }

  private saveEnabled(): void {
    setSetting(SETTING_KEYS.enabledExtractors, JSON.stringify(Array.from(this.enabledIds)));
  }

  private rebuildMap(): void {
    this.extensionToExtractor.clear();
    for (const entry of EXTRACTORS) {
      if (!this.enabledIds.has(entry.id)) continue;
      for (const ext of entry.extractor.extensions) {
        this.extensionToExtractor.set(ext.toLowerCase(), entry.extractor);
      }
    }
  }

  setEnabled(ids: ExtractorId[]): void {
    this.enabledIds = new Set(ids);
    this.saveEnabled();
    this.rebuildMap();
  }

  getEnabled(): ExtractorId[] {
    return Array.from(this.enabledIds);
  }

  getAvailable(): Array<{ id: ExtractorId; label: string }> {
    return EXTRACTORS.map((e) => ({ id: e.id, label: e.label }));
  }

  isSupportedFile(filePath: string): boolean {
    return this.getExtractor(filePath) !== undefined;
  }

  getExtractor(filePath: string): FileExtractor | undefined {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return this.extensionToExtractor.get(ext);
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.extensionToExtractor.keys());
  }
}

export const extractorManager = new ExtractorManager();
