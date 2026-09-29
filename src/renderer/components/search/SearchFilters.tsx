import clsx from 'clsx';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Folder, Plus, X } from 'lucide-react';
import { forwardRef, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { getBasename } from '../../lib/path.js';
import {
  FILTER_KIND_LABELS,
  FILTER_PRESETS,
  upsertFilter,
  type FilterKind,
  type SearchFilter,
} from '../../lib/query.js';
import { useFoldersStore } from '../../stores/foldersStore.js';
import { useSearchStore } from '../../stores/searchStore.js';
import { handleMenuKeys } from '../ui/Menu.js';
import { Popover } from '../ui/Popover.js';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
}

/** The one chip style used by scope, filters and quick suggestions. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active, icon, trailing, className, children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150',
        active
          ? 'border-transparent bg-accent-soft text-accent-text hover:brightness-110'
          : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg',
        className
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {trailing}
    </button>
  );
});

/** Chooses which library folders are searched. */
function ScopeChip() {
  const folders = useFoldersStore((s) => s.folders);
  const folderIds = useSearchStore((s) => s.folderIds);
  const setFolderIds = useSearchStore((s) => s.setFolderIds);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const selected = folders.filter((f) => folderIds.includes(f.id));
  const label =
    selected.length === 0
      ? 'All folders'
      : selected.length === 1
        ? getBasename(selected[0].path)
        : `${selected.length} folders`;

  const toggle = (id: number) =>
    setFolderIds(folderIds.includes(id) ? folderIds.filter((x) => x !== id) : [...folderIds, id]);

  return (
    <>
      <Chip
        ref={ref}
        active={selected.length > 0}
        icon={<Folder size={13} />}
        trailing={<ChevronDown size={13} className="opacity-70" />}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Search in: ${label}`}
      >
        {label}
      </Chip>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={260} role="menu" label="Search in">
        <div className="p-1" onKeyDown={handleMenuKeys}>
          <p className="px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-fg-3">Search in</p>
          <ScopeOption checked={selected.length === 0} label="All folders" onSelect={() => setFolderIds([])} />
          {folders.length > 0 && <div className="my-1 h-px bg-line" />}
          {folders.map((folder) => (
            <ScopeOption
              key={folder.id}
              checked={folderIds.includes(folder.id)}
              label={getBasename(folder.path)}
              detail={folder.path}
              muted={folder.enabled === 0}
              onSelect={() => toggle(folder.id)}
            />
          ))}
        </div>
      </Popover>
    </>
  );
}

function ScopeOption({
  checked,
  label,
  detail,
  muted,
  onSelect,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
    >
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong'
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block truncate text-sm', muted ? 'text-fg-3' : 'text-fg')}>
          {label}
          {muted && <span className="text-xs"> · paused</span>}
        </span>
        {detail && <span className="block truncate text-2xs text-fg-3">{detail}</span>}
      </span>
    </button>
  );
}

/** Two-step picker: filter kind → value. */
function FilterPicker({
  initialKind,
  onPick,
}: {
  initialKind: FilterKind | null;
  onPick: (filter: SearchFilter) => void;
}) {
  const [kind, setKind] = useState<FilterKind | null>(initialKind);
  const active = useSearchStore((s) => s.filters);

  if (!kind) {
    return (
      <div className="p-1" onKeyDown={handleMenuKeys}>
        <p className="px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-fg-3">Filter by</p>
        {(Object.keys(FILTER_PRESETS) as FilterKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="menuitem"
            onClick={() => setKind(k)}
            className="flex h-8 w-full items-center justify-between rounded-sm px-2 text-left text-sm text-fg hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
          >
            {FILTER_KIND_LABELS[k]}
            <span className="flex items-center gap-1 text-xs text-fg-3">
              {active.find((f) => f.kind === k)?.label}
              <ChevronRight size={14} />
            </span>
          </button>
        ))}
      </div>
    );
  }

  const current = active.find((f) => f.kind === kind);
  return (
    <div className="p-1" onKeyDown={handleMenuKeys}>
      <button
        type="button"
        onClick={() => setKind(null)}
        className="flex h-7 items-center gap-1 rounded-sm px-1.5 text-2xs font-medium uppercase tracking-wide text-fg-3 hover:text-fg"
      >
        <ChevronLeft size={13} />
        {FILTER_KIND_LABELS[kind]}
      </button>
      {FILTER_PRESETS[kind].map((preset) => (
        <button
          key={preset.token}
          type="button"
          role="menuitemradio"
          aria-checked={current?.token === preset.token}
          onClick={() => onPick(preset)}
          className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm text-fg hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
        >
          <span className="flex-1">{preset.label}</span>
          {preset.hint && <span className="text-xs text-fg-3">{preset.hint}</span>}
          {current?.token === preset.token && <Check size={14} className="text-accent-text" />}
        </button>
      ))}
    </div>
  );
}

/** Opens the picker from a trigger chip. */
function FilterPickerChip({ filter }: { filter?: SearchFilter }) {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const pick = (next: SearchFilter) => {
    setFilters(upsertFilter(filters, next));
    setOpen(false);
    document.dispatchEvent(new CustomEvent('echo:focus-search'));
  };

  return (
    <>
      {filter ? (
        <span className="inline-flex items-center">
          <Chip
            ref={ref}
            active
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`${FILTER_KIND_LABELS[filter.kind]}: ${filter.label}. Change filter`}
            className="rounded-r-none pr-1.5"
          >
            <span className="font-normal opacity-75">{FILTER_KIND_LABELS[filter.kind]}:</span> {filter.label}
          </Chip>
          <button
            type="button"
            aria-label={`Remove ${FILTER_KIND_LABELS[filter.kind].toLowerCase()} filter`}
            onClick={() => setFilters(filters.filter((f) => f.kind !== filter.kind))}
            className="inline-flex h-7 items-center rounded-r-full bg-accent-soft pl-0.5 pr-2 text-accent-text hover:brightness-125"
          >
            <X size={12} />
          </button>
        </span>
      ) : (
        <Chip
          ref={ref}
          icon={<Plus size={13} />}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="border-dashed"
        >
          Filter
        </Chip>
      )}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={220} role="menu" label="Add filter">
        <FilterPicker initialKind={filter?.kind ?? null} onPick={pick} />
      </Popover>
    </>
  );
}

const QUICK_FILTERS: SearchFilter[] = [
  FILTER_PRESETS.modified[1],
  FILTER_PRESETS.type[0],
  FILTER_PRESETS.type[1],
];

/** Scope + filter chips under the search bar. */
export function SearchFilterBar({ showSuggestions }: { showSuggestions: boolean }) {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const hasFolders = useFoldersStore((s) => s.folders.length > 0);

  if (!hasFolders) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ScopeChip />
      {filters.map((filter) => (
        <FilterPickerChip key={filter.kind} filter={filter} />
      ))}
      {showSuggestions && filters.length === 0 && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          {QUICK_FILTERS.map((quick) => (
            <Chip
              key={quick.token}
              onClick={() => {
                setFilters(upsertFilter(filters, quick));
                document.dispatchEvent(new CustomEvent('echo:focus-search'));
              }}
            >
              {quick.kind === 'type' ? `${quick.label} files` : quick.label}
            </Chip>
          ))}
        </>
      )}
      <FilterPickerChip />
    </div>
  );
}
