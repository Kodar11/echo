import { FolderOpen } from 'lucide-react';
import { getBasename } from '../lib/path.js';

interface SearchScopeSelectorProps {
  folders: IndexedFolder[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function SearchScopeSelector({
  folders,
  selectedIds,
  onChange,
}: SearchScopeSelectorProps) {
  const allSelected = selectedIds.length === 0;

  const toggleFolder = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((folderId) => folderId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange([])}
        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
          allSelected
            ? 'bg-(--accent) text-white dark:text-black'
            : 'bg-(--panel) theme-text-secondary hover:bg-(--border)'
        }`}
      >
        All folders
      </button>
      {folders.map((folder) => {
        const selected = selectedIds.includes(folder.id);
        return (
          <button
            key={folder.id}
            onClick={() => toggleFolder(folder.id)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
              selected
                ? 'bg-(--accent) text-white dark:text-black'
                : 'bg-(--panel) theme-text-secondary hover:bg-(--border)'
            }`}
          >
            <FolderOpen size={11} strokeWidth={1.8} />
            {getBasename(folder.path)}
          </button>
        );
      })}
    </div>
  );
}
