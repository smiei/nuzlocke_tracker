"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createRun, deleteRun, renameRun } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { RunMode } from "@/generated/prisma/enums";
import type { RunSummary } from "@/lib/types";
import { NewRunDialog } from "@/components/NewRunDialog";
import { RenameRunDialog } from "@/components/RenameRunDialog";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.9 4.1a2.1 2.1 0 013 3L8.5 18.5 4 20l1.5-4.5L16.9 4.1z"
      />
    </svg>
  );
}

export function RunSwitcher({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const { lang } = useLanguage();
  const { confirm, alert } = useDialog();
  const t = translations[lang].runSwitcher;

  const activeId = Number(searchParams.get("run")) || runs[0]?.id;
  const activeRun = runs.find((r) => r.id === activeId);

  function handleChange(value: string) {
    router.push(`${pathname}?run=${value}`);
  }

  function handleCreate(name: string, mode: RunMode) {
    startTransition(async () => {
      const result = await createRun(name, mode);
      if (result.success) {
        setDialogOpen(false);
        router.push(`${pathname}?run=${result.runId}`);
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  function handleRename(name: string) {
    if (!activeRun) return;
    startTransition(async () => {
      const result = await renameRun(activeRun.id, name);
      if (result.success) {
        setRenameOpen(false);
        router.refresh();
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  async function handleDelete() {
    if (!activeRun) return;

    const confirmOpts = { danger: true, confirmLabel: t.deleteButton };
    if (!(await confirm({ ...confirmOpts, message: t.confirmDelete1(activeRun.name) }))) return;
    if (!(await confirm({ ...confirmOpts, message: t.confirmDelete2(activeRun.name) }))) return;

    startTransition(async () => {
      const result = await deleteRun(activeRun.id);
      if (result.success) {
        router.push(pathname);
      } else {
        await alert({ message: formatActionError(result.error, lang) });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={activeId ? String(activeId) : ""}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="max-w-40 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50 sm:max-w-56 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.name}
            {run.mode === RunMode.CLASSIC ? t.soloSuffix : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => setDialogOpen(true)}
        className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {t.newRun}
      </button>
      {activeRun && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRenameOpen(true)}
            aria-label={t.renameLabel(activeRun.name)}
            title={t.renameLabel(activeRun.name)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            aria-label={t.deleteLabel(activeRun.name)}
            title={t.deleteLabel(activeRun.name)}
            className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {t.deleteButton}
          </button>
        </>
      )}
      <NewRunDialog
        lang={lang}
        open={dialogOpen}
        pending={pending}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
      <RenameRunDialog
        lang={lang}
        open={renameOpen}
        pending={pending}
        currentName={activeRun?.name ?? ""}
        onClose={() => setRenameOpen(false)}
        onRename={handleRename}
      />
    </div>
  );
}
