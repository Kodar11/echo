export const SETTING_KEYS = {
  autoSyncOnStartup: 'auto_sync_on_startup',
  enableWatchers: 'enable_watchers',
  removeStopWords: 'remove_stop_words',
  enableStemming: 'enable_stemming',
  enableLanguageDetection: 'enable_language_detection',
  indexMetadata: 'index_metadata',

  // Phase 6 — Index Management
  maxFileSizeBytes: 'max_file_size_bytes',
  enabledExtractors: 'enabled_extractors',
  indexingMode: 'indexing_mode',
  scheduleInterval: 'schedule_interval',
  enableIndexLogging: 'enable_index_logging',
  enableWatcherLogging: 'enable_watcher_logging',
  enableErrorLogging: 'enable_error_logging',
  enableDebugLogging: 'enable_debug_logging',

  // Phase 7 — Reliability & Database
  autoRecovery: 'auto_recovery',
  transactionLogging: 'transaction_logging',
  automaticMaintenance: 'automatic_maintenance',
  migrationBehavior: 'migration_behavior',
  recoveryBehavior: 'recovery_behavior',
  enableIntegrityCheckOnStartup: 'enable_integrity_check_on_startup',
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;
