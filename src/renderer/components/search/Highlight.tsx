import { memo, useMemo } from 'react';

interface HighlightProps {
  text: string;
  terms: readonly string[];
  phraseTerms?: readonly string[];
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Unicode-aware word matcher (works for Devanagari as well as Latin text). */
function buildPattern(terms: readonly string[]): RegExp | null {
  const unique = Array.from(new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  if (unique.length === 0) return null;
  unique.sort((a, b) => b.length - a.length);
  // Longer terms may extend to the end of the word (stems, prefixes).
  const alternatives = unique.map((t) => (t.length >= 4 ? `${escape(t)}[\\p{L}\\p{M}\\p{N}]*` : escape(t)));
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
}

/** Renders text with matched query terms marked; phrase words are emphasised. */
export const Highlight = memo(function Highlight({ text, terms, phraseTerms = [] }: HighlightProps) {
  const parts = useMemo(() => {
    const phrase = new Set(phraseTerms.map((t) => t.toLowerCase()));
    const pattern = buildPattern([...terms, ...phraseTerms]);
    if (!pattern) return [{ text, kind: 'text' as const }];
    const out: { text: string; kind: 'text' | 'term' | 'phrase' }[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > last) out.push({ text: text.slice(last, index), kind: 'text' });
      const word = match[0];
      out.push({ text: word, kind: phrase.has(word.toLowerCase()) ? 'phrase' : 'term' });
      last = index + word.length;
    }
    if (last < text.length) out.push({ text: text.slice(last), kind: 'text' });
    return out;
  }, [text, terms, phraseTerms]);

  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <mark key={i} className={part.kind === 'phrase' ? 'hl-phrase' : 'hl'}>
            {part.text}
          </mark>
        )
      )}
    </>
  );
});
