import type { ReactNode } from 'react';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  maxWidth?: MaxWidth;
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
}

const maxWidthClasses: Record<MaxWidth, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
  '3xl': 'max-w-7xl',
  full: 'max-w-none',
};

export function PageShell({
  children,
  title,
  subtitle,
  actions,
  maxWidth = 'md',
  isLoading,
  loadingText = 'Loading…',
  className = '',
}: PageShellProps) {
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto px-8 py-6 ${className}`}
    >
      <div
        className={`mx-auto w-full ${maxWidthClasses[maxWidth]} space-y-6`}
      >
        {(title || actions) && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && (
                <h1 className="text-lg font-medium tracking-tight theme-text">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs theme-text-secondary">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm theme-text-secondary">{loadingText}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
