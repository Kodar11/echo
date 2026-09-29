import clsx from 'clsx';

interface ProgressBarProps {
  /** Fraction in [0, 1]; null renders an indeterminate bar. */
  value: number | null;
  label: string;
  className?: string;
  tone?: 'accent' | 'warning';
}

export function ProgressBar({ value, label, className, tone = 'accent' }: ProgressBarProps) {
  const percent = value === null ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={clsx('relative h-1 w-full overflow-hidden rounded-full bg-press', className)}
    >
      <div
        className={clsx(
          'absolute inset-y-0 left-0 rounded-full',
          tone === 'accent' ? 'bg-accent' : 'bg-warning',
          value === null ? 'motion-ambient w-2/5 animate-[indeterminate_1.3s_ease-in-out_infinite]' : 'transition-[width] duration-300 ease-out'
        )}
        style={value === null ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
