"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function RenameRunDialog({
  lang,
  open,
  pending,
  currentName,
  onClose,
  onRename,
}: {
  lang: Lang;
  open: boolean;
  pending: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const t = translations[lang].runSwitcher;
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    // After Modal's own focus pass, so the text ends up selected rather than
    // just focused - retyping a name is the common case here.
    const id = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(id);
  }, [open, currentName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    onRename(trimmed);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.renameTitle}
      // A half-typed name should not be thrown away by a stray tap outside.
      dismissOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button size="sm" disabled={pending} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={pending}
            disabled={!name.trim()}
          >
            {t.save}
          </Button>
        </>
      }
    >
      <FieldLabel htmlFor="rename-run-name">{t.nameLabel}</FieldLabel>
      <Input
        id="rename-run-name"
        ref={inputRef}
        type="text"
        value={name}
        disabled={pending}
        onChange={(e) => setName(e.target.value)}
      />
    </Modal>
  );
}
