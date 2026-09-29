import { ListFilter } from 'lucide-react';
import type { SortMode } from '../stores/searchStore.js';
import { Select } from './ui/Select.js';

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
      <Select
        value={value}
        options={OPTIONS}
        onChange={(v) => onChange(v as SortMode)}
        className="w-32"
      />
    </div>
  );
}
