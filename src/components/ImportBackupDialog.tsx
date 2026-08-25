"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// Always asks for a name per run before it's created - re-importing an old
// backup of a run that's since moved on (a very common flow) used to just
// silently recreate it under the same name as the newer, actual run, making
// the two impossible to tell apart in the run switcher afterwards.
export function ImportBackupDialog({
  lang,
  pending,
  runs,
  existingNames,
  onClose,
  onConfirm,
}: {
  lang: Lang;
  pending: boolean;
  runs: { name: string }[];
  existingNames: string[];
  onClose: () => void;
  onConfirm: (names: string[]) => void;
}) {
  const t = translations[lang].backup;
  const [names, setNames] = useState<string[]>(() => runs.map(() => ""));
  const existing = new Set(existingNames);

  function setName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }

  const trimmed = names.map((n) => n.trim());
  const allFilled = trimmed.every((n) => n.length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) return;
    onConfirm(trimmed);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.importTitle}
      size="md"
      // The dialog is nothing but typed input; a backdrop tap must not discard it.
      dismissOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button size="sm" disabled={pending} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!allFilled}>
            {t.importConfirm}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-ink-muted">{t.importIntro}</p>
      <div className="flex flex-col gap-4">
        {runs.map((run, i) => (
          <div key={i}>
            <FieldLabel htmlFor={`import-run-${i}`}>{t.importNameLabel(i, runs.length)}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={`import-run-${i}`}
                type="text"
                autoFocus={i === 0}
                value={names[i]}
                disabled={pending}
                onChange={(e) => setName(i, e.target.value)}
                className="min-w-0 flex-1"
              />
              <Button
                size="md"
                disabled={pending}
                title={t.importUseBackupName}
                onClick={() => setName(i, run.name)}
              >
                {t.importUseBackupName}
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-subtle">{t.importOriginalName(run.name)}</p>
            {trimmed[i].length > 0 && existing.has(trimmed[i]) && (
              <p className="mt-1 text-xs text-warning">{t.importNameCollision}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
