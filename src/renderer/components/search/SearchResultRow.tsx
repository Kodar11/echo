import clsx from 'clsx';
import { Copy, ExternalLink, FolderOpen } from 'lucide-react';
import { memo } from 'react';
import { formatBytes, formatFileDate } from '../../lib/format.js';
import { getBreadcrumb } from '../../lib/path.js';
import { FileIcon } from '../FileIcon.js';
import { IconButton } from '../ui/IconButton.js';
import { Highlight } from './Highlight.js';

interface SearchResultRowProps {
  result: SearchResult;
  index: number;
  id: string;
  selected: boolean;
  roots: readonly string[];
  onSelect: (index: number) => void;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onCopy: (path: string) => void;
}

/**
 * One result: type tile, name, location, a matched snippet and metadata.
 * Click selects, double-click / Enter opens; actions appear on hover and on
 * the selected row.
 */
export const SearchResultRow = memo(function SearchResultRow({
  result,
  index,
  id,
  selected,
  roots,
  onSelect,
  onOpen,
  onReveal,
  onCopy,
}: SearchResultRowProps) {
  const crumbs = getBreadcrumb(result.path, roots);
  const snippet = result.snippets[0];

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-index={index}
      onMouseDown={(e) => {
        // Keep focus in the search box (keyboard-first), but still select.
        if (!(e.target as HTMLElement).closest('button')) e.preventDefault();
        onSelect(index);
      }}
      onDoubleClick={() => onOpen(result.path)}
      className={clsx(
        'group relative flex gap-3 rounded-md px-3 py-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_76px]',
        'transition-colors duration-100',
        selected ? 'bg-selection' : 'hover:bg-hover'
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-[opacity,transform] duration-150',
          selected ? 'opacity-100' : 'scale-y-50 opacity-0'
        )}
      />

      <div className="pt-0.5">
        <FileIcon filePath={result.path} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 pr-[92px]">
          <span className="truncate text-base font-medium text-fg" title={result.filename}>
            <Highlight text={result.filename} terms={result.matchedTerms} />
          </span>
          {result.phraseMatch && (
            <span className="shrink-0 rounded-[4px] bg-accent-soft px-1.5 py-px text-2xs font-medium text-accent-text">
              Exact phrase
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
          <span className="min-w-0 truncate" title={result.path}>
            {crumbs.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="px-1 opacity-60">›</span>}
                {crumb}
              </span>
            ))}
          </span>
          <span className="shrink-0 opacity-60">·</span>
          <span className="shrink-0 tabular-nums">{formatBytes(result.size)}</span>
          <span className="shrink-0 opacity-60">·</span>
          <span className="shrink-0">{formatFileDate(result.modifiedTime)}</span>
        </div>

        {snippet && (
          <p className="mt-1.5 line-clamp-2 text-sm text-fg-2 [overflow-wrap:anywhere]">
            <Highlight text={snippet} terms={result.matchedTerms} phraseTerms={result.phraseTerms} />
          </p>
        )}
      </div>

      <div
        className={clsx(
          'absolute right-2 top-2 flex items-center gap-0.5 rounded-md transition-opacity duration-100',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        )}
      >
        <IconButton size="sm" label="Copy path" tooltipSide="top" onClick={() => onCopy(result.path)}>
          <Copy size={14} />
        </IconButton>
        <IconButton size="sm" label="Show in folder" tooltipSide="top" onClick={() => onReveal(result.path)}>
          <FolderOpen size={14} />
        </IconButton>
        <IconButton size="sm" label="Open" tooltipSide="top" onClick={() => onOpen(result.path)}>
          <ExternalLink size={14} />
        </IconButton>
      </div>
    </div>
  );
});
