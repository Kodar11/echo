interface HighlightedSnippetProps {
  snippet: string;
  terms: string[];
}

export function HighlightedSnippet({ snippet, terms }: HighlightedSnippetProps) {
  if (!snippet) return <span className="italic opacity-50">No preview</span>;
  if (terms.length === 0) return <span>{snippet}</span>;

  const escaped = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = snippet.split(pattern);

  return (
    <span>
      {parts.map((part, i) =>
        escaped.some((t) => new RegExp(`^${t}$`, 'i').test(part)) ? (
          <mark
            key={i}
            className="rounded bg-amber-400/20 px-0.5 text-amber-200"
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
