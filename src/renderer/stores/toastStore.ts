import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast, durationMs = 4000) => {
    const id = nextId++;
    // Never stack identical messages.
    const toasts = get().toasts.filter((t) => t.title !== toast.title).slice(-2);
    set({ toasts: [...toasts, { ...toast, id }] });
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>, durationMs?: number) =>
  useToastStore.getState().show(t, durationMs);

/** Maps an exception to a sentence people can act on. */
export function humanizeError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  // Strip Electron's IPC wrapper ("Error invoking remote method 'x': Error: ...").
  const message = raw.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '');
  if (/does not exist/i.test(message)) return 'That folder no longer exists.';
  if (/not a directory/i.test(message)) return 'Choose a folder rather than a file.';
  if (/EACCES|EPERM|permission/i.test(message)) return 'Echo doesn’t have permission to access it.';
  if (/sqlite|database/i.test(message)) return fallback;
  return message && message.length < 140 ? message : fallback;
}
