"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-1 text-base font-semibold">{t.importTitle}</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t.importIntro}</p>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {runs.map((run, i) => (
            <div key={i}>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t.importNameLabel(i, runs.length)}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus={i === 0}
                  value={names[i]}
                  disabled={pending}
                  onChange={(e) => setName(i, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-400"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setName(i, run.name)}
                  title={t.importUseBackupName}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  {t.importUseBackupName}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {t.importOriginalName(run.name)}
              </p>
              {trimmed[i].length > 0 && existing.has(trimmed[i]) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {t.importNameCollision}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={pending || !allFilled}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t.importConfirm}
          </button>
        </div>
      </form>
    </div>
  );
}
