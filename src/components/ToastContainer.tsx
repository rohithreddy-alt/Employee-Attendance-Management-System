import type { ToastItem } from '../types.ts';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone =
          toast.type === 'success'
            ? 'bg-emerald-700 border-emerald-600'
            : toast.type === 'error'
              ? 'bg-rose-700 border-rose-600'
              : 'bg-slate-900 border-slate-700';

        const icon =
          toast.type === 'success'
            ? 'fa-solid fa-circle-check'
            : toast.type === 'error'
              ? 'fa-solid fa-circle-exclamation'
              : 'fa-solid fa-circle-info';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-150 ${tone}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <i className={`${icon} shrink-0`} aria-hidden="true" />
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-white/80 hover:text-white shrink-0 p-1"
              aria-label="Dismiss notification"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
