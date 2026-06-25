import { FolderOpen, ExternalLink } from 'lucide-react';
import { FileIcon } from './FileIcon.js';
import { SnippetHighlighter } from './SnippetHighlighter.js';
import { getBasename, getDirname, getExtension } from '../lib/path.js';

interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  matchedTerms: string[];
  onOpen: () => void;
  onOpenFolder: (e: React.MouseEvent) => void;
}

export function SearchResultItem({
  result,
  isSelected,
  matchedTerms,
  onOpen,
  onOpenFolder,
}: SearchResultItemProps) {
  const extension = getExtension(result.path);
  const directory = getDirname(result.path);

  return (
    <button
      onClick={onOpen}
      className={`group relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
        isSelected
          ? 'border-(--accent) bg-(--accent-soft)'
          : 'border-transparent bg-(--surface) hover:bg-(--panel)'
      }`}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary group-hover:theme-text">
        <FileIcon filePath={result.path} size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium theme-text">
                {result.filename}
              </h3>
              {extension && (
                <span className="shrink-0 rounded-md bg-(--panel) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--text-secondary)">
                  {extension.slice(1)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs theme-text-tertiary">
              {directory}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={onOpenFolder}
              className="rounded-md p-1.5 text-(--text-tertiary) transition hover:bg-(--panel) hover:theme-text"
              title="Open containing folder"
            >
              <FolderOpen size={14} strokeWidth={1.8} />
            </button>
            <span className="rounded-md p-1.5 text-(--text-tertiary)">
              <ExternalLink size={14} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {result.snippets.map((snippet, index) => (
            <div
              key={index}
              className="text-sm leading-relaxed theme-text-secondary"
            >
              <SnippetHighlighter
                snippet={snippet}
                terms={matchedTerms}
                phraseTerms={result.phraseTerms}
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] theme-text-tertiary">
          <span>{formatBytes(result.size)}</span>
          <span>•</span>
          <span>{formatRelativeTime(result.modifiedTime)}</span>
          {result.phraseMatch && (
            <>
              <span>•</span>
              <span className="font-medium text-(--accent)">Phrase match</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
