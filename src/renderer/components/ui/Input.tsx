import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          h-10 w-full rounded-lg border border-(--border-strong) bg-(--panel)
          px-3 text-sm theme-text placeholder:text-(--text-tertiary)
          transition-colors focus:border-(--accent) focus-ring
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
