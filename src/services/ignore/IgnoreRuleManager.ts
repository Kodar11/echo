import path from 'path';
import { minimatch } from 'minimatch';
import {
  addIgnoreRule,
  deleteIgnoreRule,
  getEnabledIgnoreRules,
  getIgnoreRules,
  setIgnoreRuleEnabled,
  type IgnoreRuleRecord,
  type IgnoreRuleType,
} from '../../database/ignoreRules.js';
import { getBooleanSetting, setBooleanSetting } from '../../database/settings.js';

export type { IgnoreRuleRecord, IgnoreRuleType };

const DEFAULT_RULES = [
  { pattern: 'node_modules/', type: 'folder' as const },
  { pattern: '.git/', type: 'folder' as const },
  { pattern: 'dist/', type: 'folder' as const },
  { pattern: 'build/', type: 'folder' as const },
  { pattern: '*.tmp', type: 'glob' as const },
  { pattern: '*.log', type: 'glob' as const },
];

/** Persisted so defaults are seeded once per database, not once per process. */
const SEEDED_SETTING = 'ignore_rules_seeded';

export class IgnoreRuleManager {
  private rules: IgnoreRuleRecord[] = [];

  initialize(): void {
    this.refresh();
  }

  refresh(): void {
    this.seedDefaultsIfNeeded();
    this.rules = getEnabledIgnoreRules();
  }

  private seedDefaultsIfNeeded(): void {
    if (getBooleanSetting(SEEDED_SETTING, false)) return;
    if (getIgnoreRules().length === 0) {
      for (const rule of DEFAULT_RULES) {
        addIgnoreRule(rule.pattern, rule.type);
      }
    }
    setBooleanSetting(SEEDED_SETTING, true);
  }

  /**
   * Whether `filePath` is excluded by an enabled rule. When `root` (the indexed
   * folder) is given, rules are evaluated against the path relative to it, so
   * a rule like `build/` does not exclude an indexed folder that merely lives
   * inside some parent directory called "build".
   */
  shouldIgnore(filePath: string, root?: string): boolean {
    const target = root ? path.relative(root, filePath) : filePath;
    const normalized = target.replace(/\\/g, '/');
    if (normalized === '') return false;
    const basename = path.posix.basename(normalized);

    for (const rule of this.rules) {
      if (this.matchesRule(normalized, basename, rule)) {
        return true;
      }
    }
    return false;
  }

  private matchesRule(
    normalizedPath: string,
    basename: string,
    rule: IgnoreRuleRecord
  ): boolean {
    if (rule.type === 'folder') {
      const folderPattern = rule.pattern.replace(/[\\/]+$/, '');
      return normalizedPath.split('/').some((segment) => segment === folderPattern);
    }
    // Glob matching — gitignore-style: full (relative) path or basename.
    return (
      minimatch(normalizedPath, rule.pattern, { dot: true }) ||
      minimatch(basename, rule.pattern, { dot: true })
    );
  }

  getRules(): IgnoreRuleRecord[] {
    return getIgnoreRules();
  }

  addRule(pattern: string, type: IgnoreRuleType = 'glob'): IgnoreRuleRecord {
    const rule = addIgnoreRule(pattern, type);
    this.refresh();
    return rule;
  }

  setEnabled(id: number, enabled: boolean): void {
    setIgnoreRuleEnabled(id, enabled);
    this.refresh();
  }

  deleteRule(id: number): void {
    deleteIgnoreRule(id);
    this.refresh();
  }
}

export const ignoreRuleManager = new IgnoreRuleManager();
