"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Toast notifications for the admin panel.
 *
 * Replaces window.alert() — non-blocking, on-brand, and stacked so several
 * results (e.g. two uploads) stay readable.
 *
 * TWO live regions, not one. A region cannot be polite and assertive at the
 * same time, and the two kinds need different treatment: a failed save should
 * interrupt, and a successful one should not interrupt whatever is being read.
 * Flipping the single container to assertive would have made every save shout.
 */

type ToastKind = "success" | "error" | "info";

/** An optional thing to do about the toast — "Print", "Undo", "Open". */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Override the default lifetime. Rarely needed; see DURATIONS. */
  duration?: number;
}

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  /*
    `options` is a THIRD argument rather than a change to the second, so every
    existing `toast(msg)` and `toast(msg, "error")` call keeps working
    untouched.
  */
  toast: (message: string, kind?: ToastKind, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.3-7.7a1 1 0 0 1 1.7.7v4a1 1 0 1 1-2 0V6a1 1 0 0 1 .3-.7Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 2a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const STYLES: Record<ToastKind, string> = {
  success: "border-laurel bg-accent-soft/40 text-ink-muted",
  error: "border-alloy/50 bg-alloy/10 text-ink-strong",
  info: "border-line-soft bg-surface-muted text-ink",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success", options?: ToastOptions) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [
        ...current,
        { id, kind, message, action: options?.action, duration: options?.duration },
      ]);
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const failures = toasts.filter((t) => t.kind === "error");
  const rest = toasts.filter((t) => t.kind !== "error");

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/*
        Inset from both edges on a phone: `w-full` plus a right offset is
        wider than a 390px screen and pushes the whole page sideways.

        One stack on screen, two regions underneath it — failures announce
        assertively, everything else waits its turn.
      */}
      <div /* Above ConfirmDialog, which is also an overlay at z-50 — a toast about a
           failed delete must not appear behind the dialog that asked for it. */
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--admin-tabbar)+1.5rem)] z-[60] flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm">
        <div className="flex flex-col gap-2" role="alert" aria-live="assertive">
          {failures.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          {rest.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * How long a toast stays.
 *
 * An actionable one lives longest: a four-second window to notice a button,
 * decide, and hit it is a race the user loses, and the whole point of putting
 * "Print" on the invoice toast is that it is there when you reach for it.
 */
const DURATIONS = { plain: 4000, error: 7000, actionable: 10000 } as const;

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const lifetime =
    toast.duration ??
    (toast.action
      ? DURATIONS.actionable
      : toast.kind === "error"
        ? DURATIONS.error
        : DURATIONS.plain);

  // Held while the pointer or the keyboard is on it, so a toast cannot expire
  // out from under someone in the middle of reading or reaching for it.
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(onDismiss, lifetime);
    return () => clearTimeout(timer);
  }, [lifetime, onDismiss, held]);

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      className={`admin-toast pointer-events-auto flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm font-medium sm:flex-row sm:items-start ${STYLES[toast.kind]}`}
    >
      <div className="flex flex-1 items-start gap-3">
        <span className="mt-px shrink-0">{ICONS[toast.kind]}</span>
        <p className="flex-1 leading-snug">{toast.message}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        {toast.action && (
          /* Below sm this drops to its own row: a 44px action and a 44px
             dismiss alongside the message do not fit 358px of phone. */
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="admin-tap rounded-lg px-3 text-sm font-bold underline underline-offset-2 hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="admin-tap-square -my-2 -mr-2 flex shrink-0 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
