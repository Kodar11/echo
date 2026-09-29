import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { forwardRef, useState, type KeyboardEvent } from 'react';
import { completableToken } from '../../lib/query.js';
import { useSearchStore } from '../../stores/searchStore.js';
import { Kbd, MOD_KEY } from '../ui/Kbd.js';
import { Spinner } from '../ui/Spinner.js';

interface SearchBarProps {
  size: 'hero' | 'compact';
  /** Keys the bar doesn't handle itself (result navigation etc.). */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  activeDescendant?: string;
  listboxId: string;
  expanded: boolean;
  invalid: boolean;
}

/**
 * The search field. Owns text entry, inline word completion (Tab / →) and
 * the clear action; result navigation is delegated to the page.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { size, onKeyDown, activeDescendant, listboxId, expanded, invalid },
  ref
) {
  const query = useSearchStore((s) => s.query);
  const completion = useSearchStore((s) => s.completion);
  const isSearching = useSearchStore((s) => s.isSearching);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const [focused, setFocused] = useState(false);

  const token = completableToken(query);
  const ghost =
    focused && token && completion && completion.startsWith(token.toLowerCase())
      ? completion.slice(token.length)
      : '';

  const acceptCompletion = (input: HTMLInputElement) => {
    if (!ghost) return false;
    if (input.selectionStart !== query.length) return false;
    setQuery(`${query}${ghost} `);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && !e.shiftKey)) {
      if (acceptCompletion(e.currentTarget)) {
        e.preventDefault();
        return;
      }
    }
    onKeyDown(e);
  };

  const hero = size === 'hero';

  return (
    <div
      className={clsx(
        'group relative flex w-full items-center rounded-lg border bg-surface',
        'transition-[box-shadow,border-color,height] duration-200 ease-out',
        'shadow-bar focus-within:shadow-bar-focus',
        invalid ? 'border-danger/60 focus-within:border-danger' : 'border-line hover:border-line-strong focus-within:border-accent',
        hero ? 'h-[52px]' : 'h-11'
      )}
    >
      <span className={clsx('flex shrink-0 items-center justify-center text-fg-3 transition-colors group-focus-within:text-accent-text', hero ? 'w-12' : 'w-11')}>
        {isSearching ? <Spinner size={hero ? 18 : 16} /> : <Search size={hero ? 19 : 17} strokeWidth={2} />}
      </span>

      <div className="relative h-full min-w-0 flex-1">
        {ghost && (
          <div
            aria-hidden="true"
            className={clsx('pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre', hero ? 'text-lg' : 'text-base')}
          >
            <span className="invisible">{query}</span>
            <span className="text-fg-3">{ghost}</span>
            <Kbd keys={['Tab']} className="ml-2 opacity-80" />
          </div>
        )}
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-label="Search your files"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={activeDescendant}
          aria-invalid={invalid || undefined}
          spellCheck={false}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search your files…"
          className={clsx(
            'relative h-full w-full bg-transparent text-fg placeholder:text-fg-3',
            hero ? 'text-lg' : 'text-base'
          )}
        />
      </div>

      <div className="flex shrink-0 items-center pr-2.5 pl-2">
        {query ? (
          <button
            type="button"
            onClick={() => {
              clear();
              (ref as React.RefObject<HTMLInputElement>).current?.focus();
            }}
            aria-label="Clear search"
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg"
          >
            <X size={16} />
          </button>
        ) : (
          <Kbd keys={[MOD_KEY, 'K']} className={clsx('transition-opacity', focused && 'opacity-0')} />
        )}
      </div>
    </div>
  );
});
