interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'sm',
  showLabel,
  className = '',
}: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const height = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-micro theme-text-tertiary">
          <span>{value} / {max}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full bg-(--border-strong) ${height}`}
      >
        <div
          className="h-full rounded-full bg-(--accent) transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
