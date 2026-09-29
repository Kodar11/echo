import { getBooleanSetting, getSetting, setSetting } from '../database/settings.js';
import { SETTING_KEYS } from '../settings/keys.js';

/**
 * Settings that affect indexing, read once per session so a whole session
 * uses one consistent configuration.
 */
export interface IndexingSettings {
  maxFileSizeBytes: number;
  detectLanguage: boolean;
  removeStopWords: boolean;
  indexMetadata: boolean;
  skipHidden: boolean;
}

/**
 * Bump when tokenization or the stored index format changes in a way that
 * requires re-indexing existing files.
 */
export const INDEX_FORMAT_VERSION = 2;

export function loadIndexingSettings(): IndexingSettings {
  const raw = getSetting(SETTING_KEYS.maxFileSizeBytes);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return {
    maxFileSizeBytes: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    detectLanguage: getBooleanSetting(SETTING_KEYS.enableLanguageDetection, true),
    removeStopWords: getBooleanSetting(SETTING_KEYS.removeStopWords, false),
    indexMetadata: getBooleanSetting(SETTING_KEYS.indexMetadata, true),
    skipHidden: true,
  };
}

/**
 * Fingerprint of everything that changes what gets written for a file whose
 * bytes did not change. If it differs from the fingerprint recorded by the
 * last completed full sync, the next full sync re-indexes every file.
 */
export function computeIndexFingerprint(settings: IndexingSettings): string {
  return JSON.stringify({
    format: INDEX_FORMAT_VERSION,
    detectLanguage: settings.detectLanguage,
    removeStopWords: settings.removeStopWords,
    indexMetadata: settings.indexMetadata,
  });
}

export function getIndexedFingerprint(): string | undefined {
  return getSetting(SETTING_KEYS.indexedFingerprint);
}

/** True if existing index entries were built with a different configuration. */
export function isIndexConfigStale(settings: IndexingSettings = loadIndexingSettings()): boolean {
  const stored = getIndexedFingerprint();
  return stored !== undefined && stored !== computeIndexFingerprint(settings);
}

export function setIndexedFingerprint(fingerprint: string): void {
  setSetting(SETTING_KEYS.indexedFingerprint, fingerprint);
}
