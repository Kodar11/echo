import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'h-8 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-fg-3',
        'transition-[border-color,box-shadow] duration-150 hover:border-line-strong',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
