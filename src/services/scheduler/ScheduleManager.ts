import { getBooleanSetting, getSetting, setSetting } from '../../database/settings.js';
import { SETTING_KEYS } from '../../settings/keys.js';
import { getLogger } from '../logger/logger.js';

export type IndexingMode = 'immediate' | 'startup' | 'scheduled' | 'manual';
export type ScheduleInterval = 'hourly' | 'daily';

const SCHEDULE_INTERVAL_MS: Record<ScheduleInterval, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export interface ScheduleManagerOptions {
  onStartupSync: () => Promise<void>;
}

export class ScheduleManager {
  private options: ScheduleManagerOptions;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private lastScheduledRun = 0;

  constructor(options: ScheduleManagerOptions) {
    this.options = options;
  }

  getOptions(): ScheduleManagerOptions {
    return this.options;
  }

  getIndexingMode(): IndexingMode {
    const raw = getSetting(SETTING_KEYS.indexingMode);
    if (raw === 'startup' || raw === 'scheduled' || raw === 'manual') {
      return raw;
    }
    return 'immediate';
  }

  setIndexingMode(mode: IndexingMode): void {
    setSetting(SETTING_KEYS.indexingMode, mode);
  }

  getScheduleInterval(): ScheduleInterval {
    const raw = getSetting(SETTING_KEYS.scheduleInterval);
    if (raw === 'hourly' || raw === 'daily') {
      return raw;
    }
    return 'daily';
  }

  setScheduleInterval(interval: ScheduleInterval): void {
    setSetting(SETTING_KEYS.scheduleInterval, interval);
  }

  shouldEnableWatchers(): boolean {
    return this.getIndexingMode() === 'immediate';
  }

  shouldRunStartupSync(): boolean {
    const mode = this.getIndexingMode();
    return mode === 'immediate' || mode === 'startup';
  }

  start(): void {
    this.stop();

    if (this.getIndexingMode() !== 'scheduled') return;

    const interval = SCHEDULE_INTERVAL_MS[this.getScheduleInterval()];
    this.scheduleTimer = setInterval(() => {
      this.runScheduledSync();
    }, interval);

    // Run once shortly after start if enough time has passed.
    if (Date.now() - this.lastScheduledRun >= interval) {
      setTimeout(() => this.runScheduledSync(), 5000);
    }
  }

  stop(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  private runScheduledSync(): void {
    this.lastScheduledRun = Date.now();
    getLogger().info(
      'index',
      'ScheduleManager',
      `Running scheduled sync (${this.getScheduleInterval()})`
    );
    this.options.onStartupSync().catch((err) => {
      getLogger().error(
        'index',
        'ScheduleManager',
        `Scheduled sync failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }
}
