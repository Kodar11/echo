export const SETTING_KEYS = {
  autoSyncOnStartup: 'auto_sync_on_startup',
  enableWatchers: 'enable_watchers',
  removeStopWords: 'remove_stop_words',
  enableStemming: 'enable_stemming',
  enableLanguageDetection: 'enable_language_detection',
  indexMetadata: 'index_metadata',
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;
