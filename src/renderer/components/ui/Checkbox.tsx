import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          flex h-4 w-4 shrink-0 items-center justify-center rounded
          border transition-colors focus-ring
          ${
            checked
              ? 'border-(--accent) bg-(--accent) text-(--accent-foreground)'
              : 'border-(--border-strong) bg-(--panel) hover:border-(--accent)'
          }
        `}
      >
        {checked && <Check size={12} strokeWidth={2.5} />}
      </button>
      {label && <span className="text-sm theme-text-secondary">{label}</span>}
    </label>
  );
}
