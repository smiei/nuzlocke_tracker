"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

// Non-blocking feedback, replacing 21 blocking alert() calls across 6 files.
//
// Two things it fixes beyond "modals are annoying": nineteen of the app's
// twenty-one mutations confirmed nothing at all on success, and the gear menu's
// export/delete actions closed the menu BEFORE firing, so the control the user
// tapped no longer existed to report back through. A toast has no such
// dependency on the trigger still being on screen.
//
// Hand-rolled on purpose - the project keeps nine runtime dependencies and a
// toast is thirty lines.

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

const TONES: Record<Tone, string> = {
  success: "border-success-line bg-success-bg text-success",
  error: "border-danger-line bg-danger-bg text-danger",
  info: "border-info-line bg-info-bg text-info",
};

// Errors stay longer: they usually carry something the user has to read and
// act on, while a success is just reassurance.
const DURATION: Record<Tone, number> = { success: 3000, error: 7000, info: 4000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      // Cap the stack so a burst (e.g. a failing backup import looping) cannot
      // cover the screen.
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), DURATION[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live so the message is announced without stealing focus - the
          whole point of not using a modal. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 text-left text-sm shadow-lg",
              TONES[toast.tone],
            )}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
