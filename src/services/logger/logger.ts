import fs from 'fs';
import path from 'path';

export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
export type LogCategory = 'index' | 'watcher' | 'errors' | 'debug';

export interface LogEntry {
  timestamp: string;
  severity: LogSeverity;
  category: LogCategory;
  component: string;
  message: string;
}

export interface LoggerOptions {
  logDir: string;
  enabledCategories?: Partial<Record<LogCategory, boolean>>;
}

const DEFAULT_ENABLED: Record<LogCategory, boolean> = {
  index: true,
  watcher: true,
  errors: true,
  debug: false,
};

export class Logger {
  private logDir: string;
  private enabledCategories: Record<LogCategory, boolean>;
  private streams: Map<LogCategory, fs.WriteStream> = new Map();

  constructor(options: LoggerOptions) {
    this.logDir = options.logDir;
    this.enabledCategories = {
      ...DEFAULT_ENABLED,
      ...(options.enabledCategories ?? {}),
    };
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getStream(category: LogCategory): fs.WriteStream | null {
    if (!this.enabledCategories[category]) return null;

    let stream = this.streams.get(category);
    if (!stream) {
      const filePath = path.join(this.logDir, `${category}.log`);
      stream = fs.createWriteStream(filePath, { flags: 'a' });
      this.streams.set(category, stream);
    }
    return stream;
  }

  private write(
    severity: LogSeverity,
    category: LogCategory,
    component: string,
    message: string
  ): void {
    if (!this.enabledCategories[category]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      category,
      component,
      message,
    };

    const line = `${entry.timestamp} [${entry.severity}] [${entry.component}] ${entry.message}\n`;

    const stream = this.getStream(category);
    if (stream) {
      stream.write(line);
    }

    // Always mirror errors to console in development.
    if (severity === 'ERROR') {
      console.error(line.trim());
    } else if (severity === 'WARNING') {
      console.warn(line.trim());
    }
  }

  info(category: LogCategory, component: string, message: string): void {
    this.write('INFO', category, component, message);
  }

  warn(category: LogCategory, component: string, message: string): void {
    this.write('WARNING', category, component, message);
  }

  error(category: LogCategory, component: string, message: string): void {
    this.write('ERROR', category, component, message);
  }

  debug(category: LogCategory, component: string, message: string): void {
    this.write('DEBUG', category, component, message);
  }

  getLogDir(): string {
    return this.logDir;
  }

  setEnabledCategories(categories: Partial<Record<LogCategory, boolean>>): void {
    this.enabledCategories = { ...this.enabledCategories, ...categories };
  }

  close(): void {
    for (const stream of this.streams.values()) {
      stream.end();
    }
    this.streams.clear();
  }

  closeAsync(): Promise<void> {
    const streams = Array.from(this.streams.values());
    this.streams.clear();
    return Promise.all(
      streams.map(
        (stream) =>
          new Promise<void>((resolve) => {
            stream.end(() => resolve());
          })
      )
    ).then(() => undefined);
  }
}

let globalLogger: Logger | null = null;

export function createLogger(options: LoggerOptions): Logger {
  globalLogger = new Logger(options);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    // Fallback logger writes to a temp directory until properly initialized.
    return new Logger({ logDir: path.join(process.cwd(), 'logs') });
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}
