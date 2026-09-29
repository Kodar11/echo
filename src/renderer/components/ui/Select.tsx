import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled,
  className = '',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-(--border-strong) bg-(--panel) px-3 text-sm theme-text transition-colors focus:border-(--accent) focus-ring disabled:opacity-50"
      >
        <span className={selected ? 'theme-text' : 'theme-text-tertiary'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`theme-text-tertiary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-(--border) bg-(--surface) py-1 shadow-lg">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm theme-text transition-colors hover:bg-(--panel)"
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check size={14} className="text-(--accent)" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
