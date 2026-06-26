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

export type { IgnoreRuleRecord, IgnoreRuleType };

const DEFAULT_RULES = [
  { pattern: 'node_modules/', type: 'folder' as const },
  { pattern: '.git/', type: 'folder' as const },
  { pattern: 'dist/', type: 'folder' as const },
  { pattern: 'build/', type: 'folder' as const },
  { pattern: '*.tmp', type: 'glob' as const },
  { pattern: '*.log', type: 'glob' as const },
];

export class IgnoreRuleManager {
  private rules: IgnoreRuleRecord[] = [];
  private seeded = false;

  initialize(): void {
    this.refresh();
  }

  refresh(): void {
    this.rules = getEnabledIgnoreRules();
    this.seedDefaultsIfEmpty();
  }

  private seedDefaultsIfEmpty(): void {
    if (this.seeded) return;
    const existing = getIgnoreRules();
    if (existing.length > 0) {
      this.seeded = true;
      return;
    }

    for (const rule of DEFAULT_RULES) {
      addIgnoreRule(rule.pattern, rule.type);
    }
    this.seeded = true;
    this.rules = getEnabledIgnoreRules();
  }

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const basename = path.basename(normalized);

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
      const folderPattern = rule.pattern.endsWith('/')
        ? rule.pattern.slice(0, -1)
        : rule.pattern;
      return normalizedPath
        .split('/')
        .some((segment) => segment === folderPattern);
    }

    // Glob matching — gitignore-style.
    return minimatch(normalizedPath, rule.pattern, { dot: true }) ||
      minimatch(basename, rule.pattern, { dot: true });
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
