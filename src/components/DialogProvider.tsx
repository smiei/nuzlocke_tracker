"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type AlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
};

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

type DialogState =
  | { kind: "confirm"; options: ConfirmOptions }
  | { kind: "alert"; options: AlertOptions };

const DialogContext = createContext<DialogApi | null>(null);

// In-app replacement for window.confirm / window.alert. Returns a promise so
// call sites read almost identically: `if (await confirm(...))` /
// `await alert(...)`. Only one dialog shows at a time; sequential awaited
// calls (e.g. a two-step delete confirmation) queue naturally.
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  const t = translations[lang].dialog;
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setDialog({ kind: "confirm", options });
      }),
    [],
  );

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        resolveRef.current = () => resolve();
        setDialog({ kind: "alert", options });
      }),
    [],
  );

  const handleClose = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
  }, []);

  const api = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && <DialogModal dialog={dialog} labels={t} onClose={handleClose} />}
    </DialogContext.Provider>
  );
}

function DialogModal({
  dialog,
  labels,
  onClose,
}: {
  dialog: DialogState;
  labels: { ok: string; cancel: string; confirm: string };
  onClose: (result: boolean) => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isConfirm = dialog.kind === "confirm";

  useEffect(() => {
    primaryRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const danger = isConfirm && dialog.options.danger === true;
  const confirmLabel = isConfirm
    ? dialog.options.confirmLabel ?? labels.confirm
    : dialog.options.okLabel ?? labels.ok;
  const cancelLabel = isConfirm ? dialog.options.cancelLabel ?? labels.cancel : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        {dialog.options.title && (
          <h2 className="mb-2 text-base font-semibold">{dialog.options.title}</h2>
        )}
        <p className="mb-4 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">
          {dialog.options.message}
        </p>
        <div className="flex justify-end gap-2">
          {cancelLabel && (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => onClose(true)}
            className={
              danger
                ? "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                : "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
