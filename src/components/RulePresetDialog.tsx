"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteRulePreset, saveRulePreset } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PRESET_NAME_MAX } from "@/lib/runSettings";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export type RulePresetSummary = { id: number; name: string };

// Saving and managing in one dialog: naming a ruleset and seeing which ones
// already exist are the same thought, and splitting them would mean two ways
// in for one feature.
//
// The two confirmations here are deliberately NOT useDialog().confirm. That
// renders its own Modal, and two stacked Modals both listen for Escape on
// `document` in the capture phase - one keypress would close both. So
// overwriting is a relabelled button (the name field already tells you it
// exists) and deleting is a two-step inline confirm on the row itself.
export function RulePresetDialog({
  open,
  onClose,
  runId,
  lang,
  presets,
}: {
  open: boolean;
  onClose: () => void;
  runId: number;
  lang: Lang;
  presets: RulePresetSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const t = translations[lang].rules.presets;
  const tDialog = translations[lang].dialog;

  const trimmed = name.trim();
  // Exact match, not case-insensitive: the unique index on RulePreset.name is
  // case-sensitive, so offering "Overwrite" for a name that would actually
  // create a second row would be a lie.
  const existing = presets.find((preset) => preset.name === trimmed);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || pending) return;
    startTransition(async () => {
      const result = await saveRulePreset(runId, trimmed, lang);
      if (result.success) {
        toast.success(t.saved(trimmed));
        setName("");
        router.refresh();
        onClose();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function handleDelete(preset: RulePresetSummary) {
    startTransition(async () => {
      const result = await deleteRulePreset(preset.id);
      if (result.success) {
        setConfirmingId(null);
        toast.success(t.deleted(preset.name));
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.dialogTitle}
      size="md"
      // Holds typed input - a stray backdrop tap must not discard the name.
      dismissOnBackdrop={false}
      onSubmit={handleSave}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            {tDialog.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={pending}
            disabled={!trimmed}
          >
            {existing ? t.overwrite : t.saveCurrent}
          </Button>
        </>
      }
    >
      <div>
        <FieldLabel htmlFor="rule-preset-name">{t.nameLabel}</FieldLabel>
        <Input
          id="rule-preset-name"
          type="text"
          value={name}
          maxLength={PRESET_NAME_MAX}
          placeholder={t.namePlaceholder}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
        {existing && <p className="mt-1 text-xs text-warning">{t.overwriteHint(existing.name)}</p>}
        <p className="mt-2 text-xs text-ink-subtle">{t.scopeHint}</p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t.existing}
        </h3>
        {presets.length === 0 ? (
          <p className="text-sm text-ink-subtle">{t.none}</p>
        ) : (
          <ul className="divide-y divide-line">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-ink">{preset.name}</span>
                {confirmingId === preset.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-muted">{t.deleteConfirm}</span>
                    <Button size="sm" disabled={pending} onClick={() => setConfirmingId(null)}>
                      {tDialog.cancel}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-solid"
                      loading={pending}
                      onClick={() => handleDelete(preset)}
                    >
                      {t.deleteYes}
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() => setConfirmingId(preset.id)}
                  >
                    {t.delete}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
