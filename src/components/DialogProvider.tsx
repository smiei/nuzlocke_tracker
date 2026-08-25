"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

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

  const isConfirm = dialog?.kind === "confirm";
  const danger = isConfirm && dialog.options.danger === true;
  const confirmLabel = dialog
    ? isConfirm
      ? dialog.options.confirmLabel ?? t.confirm
      : dialog.options.okLabel ?? t.ok
    : "";
  const cancelLabel = isConfirm ? dialog.options.cancelLabel ?? t.cancel : null;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {/* Focus trap, Escape, scroll lock and focus restore all come from Modal
          now. This used to hand-roll a partial version of them: Escape only,
          and focus put on the primary button without a trap around it. */}
      <Modal
        open={dialog !== null}
        onClose={() => handleClose(false)}
        title={dialog?.options.title ?? confirmLabel}
        titleHidden={!dialog?.options.title}
        footer={
          <>
            {cancelLabel && (
              <Button size="sm" onClick={() => handleClose(false)}>
                {cancelLabel}
              </Button>
            )}
            <Button
              size="sm"
              variant={danger ? "danger-solid" : "primary"}
              onClick={() => handleClose(true)}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="whitespace-pre-line text-sm text-ink-muted">{dialog?.options.message}</p>
      </Modal>
    </DialogContext.Provider>
  );
}
