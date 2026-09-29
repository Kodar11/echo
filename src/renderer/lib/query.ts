/**
 * Filter chips are a UI over the query language: each chip contributes one
 * or more `key:value` tokens that are appended to the text query. The
 * backend remains the only place that parses and evaluates queries.
 */

export type FilterKind = 'type' | 'modified' | 'size' | 'language';

export interface SearchFilter {
  kind: FilterKind;
  /** Query-language tokens this chip contributes. */
  token: string;
  /** Chip label ("PDF", "Past 7 days"). */
  label: string;
}

export interface FilterPreset extends SearchFilter {
  /** Optional hint shown in the picker ("pdf"). */
  hint?: string;
}

export const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  type: 'Type',
  modified: 'Modified',
  size: 'Size',
  language: 'Language',
};

export const FILTER_PRESETS: Record<FilterKind, FilterPreset[]> = {
  type: [
    { kind: 'type', token: 'type:pdf', label: 'PDF', hint: '.pdf' },
    { kind: 'type', token: 'type:docx', label: 'Word', hint: '.docx' },
    { kind: 'type', token: 'type:md', label: 'Markdown', hint: '.md' },
    { kind: 'type', token: 'type:txt', label: 'Text', hint: '.txt' },
    { kind: 'type', token: '(type:html OR type:htm)', label: 'Web page', hint: '.html' },
  ],
  modified: [
    { kind: 'modified', token: 'modified:today', label: 'Today' },
    { kind: 'modified', token: 'modified:last7days', label: 'Past 7 days' },
    { kind: 'modified', token: 'modified:last30days', label: 'Past 30 days' },
    { kind: 'modified', token: 'modified:last1year', label: 'Past year' },
  ],
  size: [
    { kind: 'size', token: 'size<1mb', label: 'Under 1 MB' },
    { kind: 'size', token: 'size>=1mb size<25mb', label: '1 – 25 MB' },
    { kind: 'size', token: 'size>=25mb', label: 'Over 25 MB' },
  ],
  language: [
    { kind: 'language', token: 'language:eng', label: 'English' },
    { kind: 'language', token: 'language:hin', label: 'Hindi' },
    { kind: 'language', token: 'language:mar', label: 'Marathi' },
  ],
};

/** The query actually sent to the backend. */
export function composeQuery(text: string, filters: readonly SearchFilter[]): string {
  const trimmed = text.trim();
  if (filters.length === 0) return trimmed;
  const tokens = filters.map((f) => f.token).join(' ');
  // Parenthesise so a top-level OR in the text can't swallow the filters.
  return trimmed ? `(${trimmed}) ${tokens}` : tokens;
}

/** Replaces any filter of the same kind (one chip per kind). */
export function upsertFilter(filters: readonly SearchFilter[], next: SearchFilter): SearchFilter[] {
  return [...filters.filter((f) => f.kind !== next.kind), next];
}

/**
 * The word being typed at the end of the query, when it is a plain word that
 * autocompletion can extend (not a phrase, operator or `key:value`).
 */
export function completableToken(query: string): string | null {
  if (!query || /\s$/.test(query)) return null;
  const quotes = (query.match(/"/g) ?? []).length;
  if (quotes % 2 === 1) return null;
  const match = query.match(/([^\s()"]+)$/);
  if (!match) return null;
  const token = match[1];
  if (token.length < 2 || /^(and|or|not)$/i.test(token)) return null;
  if (/[:<>=]/.test(token)) return null;
  return token;
}

export const SEARCH_EXAMPLES = ['"system design"', 'type:pdf', 'modified:last7days', 'budget NOT draft'];
