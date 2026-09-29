import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IgnoreRuleManager } from './IgnoreRuleManager.js';
import {
  setupTestDatabase,
  teardownTestDatabase,
} from '../../test/testDb.js';

describe('IgnoreRuleManager', () => {
  let dbInfo: { dbPath: string };
  let manager: IgnoreRuleManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new IgnoreRuleManager();
    manager.initialize();
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('seeds default rules when empty', () => {
    const rules = manager.getRules();
    const patterns = rules.map((r) => r.pattern);
    expect(patterns).toContain('node_modules/');
    expect(patterns).toContain('.git/');
    expect(patterns).toContain('*.tmp');
    expect(patterns).toContain('*.log');
  });

  it('ignores files matching folder rules', () => {
    expect(manager.shouldIgnore('C:/project/node_modules/foo/bar.js')).toBe(
      true
    );
    expect(manager.shouldIgnore('/project/.git/HEAD')).toBe(true);
  });

  it('ignores files matching glob rules', () => {
    expect(manager.shouldIgnore('C:/project/debug.log')).toBe(true);
    expect(manager.shouldIgnore('/tmp/cache.tmp')).toBe(true);
  });

  it('does not ignore files outside matching rules', () => {
    expect(manager.shouldIgnore('C:/project/src/index.ts')).toBe(false);
    expect(manager.shouldIgnore('/docs/readme.md')).toBe(false);
  });

  it('evaluates rules relative to the indexed root', () => {
    // An indexed folder that lives under a directory named "build" must not
    // be ignored wholesale by the default `build/` rule.
    expect(manager.shouldIgnore('C:/work/build/notes/a.txt', 'C:/work/build/notes')).toBe(false);
    expect(manager.shouldIgnore('C:/work/notes/build/a.txt', 'C:/work/notes')).toBe(true);
  });

  it('re-seeds defaults for a new database but respects deletions', () => {
    for (const rule of manager.getRules()) manager.deleteRule(rule.id);
    const again = new IgnoreRuleManager();
    again.initialize();
    expect(again.getRules()).toHaveLength(0);
  });

  it('adds custom rules', () => {
    manager.addRule('*.bak', 'glob');
    expect(manager.shouldIgnore('/data/archive.bak')).toBe(true);
  });

  it('disabling a rule stops matching', () => {
    const rules = manager.getRules();
    const tmpRule = rules.find((r) => r.pattern === '*.tmp');
    expect(tmpRule).toBeDefined();
    manager.setEnabled(tmpRule!.id, false);
    expect(manager.shouldIgnore('/tmp/cache.tmp')).toBe(false);
  });

  it('deletes a rule', () => {
    const rules = manager.getRules();
    const logRule = rules.find((r) => r.pattern === '*.log');
    expect(logRule).toBeDefined();
    manager.deleteRule(logRule!.id);
    expect(manager.shouldIgnore('/tmp/app.log')).toBe(false);
  });
});
