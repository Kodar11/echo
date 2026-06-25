interface SearchStatsProps {
  totalCount: number;
  durationMs: number;
}

export function SearchStats({ totalCount, durationMs }: SearchStatsProps) {
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 text-[11px] theme-text-tertiary">
      <span>
        {totalCount} result{totalCount === 1 ? '' : 's'}
      </span>
      <span>·</span>
      <span>{durationMs} ms</span>
    </div>
  );
}
