interface HighlightedSnippetProps {
  snippet: string;
  terms: string[];
}

export function HighlightedSnippet({ snippet, terms }: HighlightedSnippetProps) {
  if (!snippet) return <span className="italic opacity-50">No preview</span>;
  if (terms.length === 0) return <span>{snippet}</span>;

  const escapedTerms = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escapedTerms.length === 0) return <span>{snippet}</span>;

  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = snippet.split(pattern);

  return (
    <span>
      {parts.map((part, i) =>
        escapedTerms.some((t) => new RegExp(`^${t}$`, 'i').test(part)) ? (
          <mark
            key={i}
            className="rounded bg-(--accent-soft) px-0.5 font-medium text-(--accent)"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
