interface SnippetHighlighterProps {
  snippet: string;
  terms: string[];
  phraseTerms?: string[];
}

export function SnippetHighlighter({
  snippet,
  terms,
  phraseTerms = [],
}: SnippetHighlighterProps) {
  if (!snippet) return <span className="italic opacity-50">No preview</span>;

  const normalizedTerms = terms
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
  const normalizedPhraseTerms = phraseTerms
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());

  if (normalizedTerms.length === 0 && normalizedPhraseTerms.length === 0) {
    return <span>{snippet}</span>;
  }

  const phrasePattern = buildPhrasePattern(normalizedPhraseTerms);
  const termPattern = buildTermPattern(normalizedTerms);

  const parts = splitByPatterns(snippet, phrasePattern, termPattern);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'phrase') {
          return (
            <mark
              key={i}
              className="rounded bg-(--accent) px-0.5 font-medium text-white"
            >
              {part.text}
            </mark>
          );
        }
        if (part.type === 'term') {
          return (
            <mark
              key={i}
              className="rounded bg-(--accent-soft) px-0.5 font-medium text-(--accent)"
            >
              {part.text}
            </mark>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </span>
  );
}

function buildPhrasePattern(terms: string[]): RegExp | null {
  if (terms.length === 0) return null;
  const escaped = terms.map(escapeRegex);
  // Match any of the phrase terms as whole words.
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function buildTermPattern(terms: string[]): RegExp | null {
  if (terms.length === 0) return null;
  const escaped = terms.map(escapeRegex);
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TextPart {
  text: string;
  type: 'phrase' | 'term' | 'text';
}

function splitByPatterns(
  snippet: string,
  phrasePattern: RegExp | null,
  termPattern: RegExp | null
): TextPart[] {
  const parts: TextPart[] = [];
  let remaining = snippet;

  while (remaining.length > 0) {
    let bestMatch: { pattern: 'phrase' | 'term'; index: number; text: string } | null = null;

    if (phrasePattern) {
      phrasePattern.lastIndex = 0;
      const match = phrasePattern.exec(remaining);
      if (match && match.index !== undefined) {
        bestMatch = { pattern: 'phrase', index: match.index, text: match[0] };
      }
    }

    if (termPattern) {
      termPattern.lastIndex = 0;
      const match = termPattern.exec(remaining);
      if (match && match.index !== undefined) {
        if (
          !bestMatch ||
          match.index < bestMatch.index ||
          (match.index === bestMatch.index && match[0].length > bestMatch.text.length)
        ) {
          bestMatch = { pattern: 'term', index: match.index, text: match[0] };
        }
      }
    }

    if (!bestMatch) {
      parts.push({ text: remaining, type: 'text' });
      break;
    }

    if (bestMatch.index > 0) {
      parts.push({ text: remaining.slice(0, bestMatch.index), type: 'text' });
    }

    parts.push({ text: bestMatch.text, type: bestMatch.pattern });
    remaining = remaining.slice(bestMatch.index + bestMatch.text.length);
  }

  return parts;
}
