import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-(--panel) py-16 text-center">
      {Icon && (
        <div className="mb-3 rounded-xl bg-(--surface) p-2.5 theme-text-tertiary">
          <Icon size={22} strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium theme-text">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed theme-text-secondary">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-(--accent) px-4 py-2 text-xs font-medium text-white transition hover:bg-(--accent-hover) dark:text-black"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
