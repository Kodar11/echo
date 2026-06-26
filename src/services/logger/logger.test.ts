import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger } from './logger.js';

async function flushLogger(logger: Logger): Promise<void> {
  await logger.closeAsync();
}

describe('Logger', () => {
  let logDir: string;
  let logger: Logger;

  beforeEach(() => {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-logger-'));
    logger = new Logger({ logDir });
  });

  afterEach(async () => {
    await flushLogger(logger);
    try {
      fs.rmSync(logDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures.
    }
  });

  it('writes info logs to the index log file', async () => {
    logger.info('index', 'Test', 'hello');
    await flushLogger(logger);

    const logPath = path.join(logDir, 'index.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('[INFO]');
    expect(content).toContain('[Test]');
    expect(content).toContain('hello');
  });

  it('writes error logs to the errors log file', async () => {
    logger.error('errors', 'Test', 'something went wrong');
    await flushLogger(logger);

    const logPath = path.join(logDir, 'errors.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('[ERROR]');
    expect(content).toContain('something went wrong');
  });

  it('skips disabled categories', async () => {
    logger = new Logger({
      logDir,
      enabledCategories: { debug: false },
    });
    logger.debug('debug', 'Test', 'hidden');
    await flushLogger(logger);

    const logPath = path.join(logDir, 'debug.log');
    expect(fs.existsSync(logPath)).toBe(false);
  });

  it('toggles categories after construction', async () => {
    logger.setEnabledCategories({ watcher: false });
    logger.warn('watcher', 'Test', 'ignored');
    logger.setEnabledCategories({ watcher: true });
    logger.warn('watcher', 'Test', 'visible');
    await flushLogger(logger);

    const logPath = path.join(logDir, 'watcher.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).not.toContain('ignored');
    expect(content).toContain('visible');
  });
});
