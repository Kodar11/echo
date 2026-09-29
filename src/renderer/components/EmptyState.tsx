import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/Button.js';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  isLoading?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  isLoading,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-(--border) bg-(--panel) py-16 text-center">
      {isLoading ? (
        <Loader2 size={28} className="animate-spin text-(--text-tertiary)" />
      ) : (
        Icon && (
          <div className="mb-3 rounded-xl bg-(--surface) p-2.5 theme-text-tertiary">
            <Icon size={22} strokeWidth={1.5} />
          </div>
        )
      )}
      <p className="text-sm font-medium theme-text">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed theme-text-secondary">
        {description}
      </p>
      {action && (
        <Button
          variant="primary"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
