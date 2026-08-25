"use client";

import { useRef } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// Shows the generated order report. The text is fetched by the caller before
// the dialog is opened, so there is no loading state and no effect here.
//
// The textarea is not decoration: this app is reached over plain http on the
// LAN, where navigator.clipboard does not exist (it is secure-context only).
// So there is a selection-based fallback, and failing that the text is on
// screen to select by hand.
export function DebugOrderDialog({
  open,
  onClose,
  lang,
  text,
  filename,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  text: string;
  filename: string;
}) {
  const toast = useToast();
  const t = translations[lang].tracker.debug;
  const tDialog = translations[lang].dialog;
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function handleCopy() {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = areaRef.current;
        if (!area) throw new Error("no textarea");
        area.focus();
        area.select();
        if (!document.execCommand("copy")) throw new Error("execCommand refused");
      }
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  }

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      size="lg"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            {tDialog.cancel}
          </Button>
          <Button size="sm" onClick={handleDownload}>
            {t.download}
          </Button>
          <Button size="sm" variant="primary" onClick={handleCopy}>
            {t.copy}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs text-ink-subtle">{t.hint}</p>
      <Textarea
        ref={areaRef}
        value={text}
        readOnly
        spellCheck={false}
        aria-label={t.title}
        className="h-96 font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
    </Modal>
  );
}
