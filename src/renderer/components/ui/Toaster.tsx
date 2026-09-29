import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastTone } from '../../stores/toastStore.js';

const ICONS: Record<ToastTone, typeof Info> = {
  neutral: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const ICON_TONE: Record<ToastTone, string> = {
  neutral: 'text-fg-3',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-raised px-3.5 py-3 shadow-pop"
          >
            <Icon size={16} className={clsx('mt-0.5 shrink-0', ICON_TONE[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-fg-2">{t.description}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-xs font-medium text-accent-text hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="-mr-1 -mt-0.5 flex h-6 w-6 items-center justify-center rounded-sm text-fg-3 hover:bg-hover hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
