import { ListFilter } from 'lucide-react';
import type { SortMode } from '../stores/searchStore.js';

interface SearchSortSelectorProps {
  value: SortMode;
  onChange: (value: SortMode) => void;
}

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'largest', label: 'Largest' },
  { value: 'smallest', label: 'Smallest' },
  { value: 'alphabetical', label: 'A–Z' },
];

export function SearchSortSelector({ value, onChange }: SearchSortSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <ListFilter size={13} className="theme-text-tertiary" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="cursor-pointer rounded-md border-none bg-transparent py-1 pr-6 pl-1 text-xs font-medium theme-text-secondary outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
