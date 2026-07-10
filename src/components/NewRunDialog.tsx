"use client";

import { useEffect, useRef, useState } from "react";
import { RunMode } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

export function NewRunDialog({
  lang,
  open,
  pending,
  onClose,
  onCreate,
}: {
  lang: Lang;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onCreate: (name: string, mode: RunMode) => void;
}) {
  const t = translations[lang].runSwitcher;
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RunMode>(RunMode.SOULLINK);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setMode(RunMode.SOULLINK);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, mode);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-3 text-base font-semibold">{t.newRunTitle}</h2>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.nameLabel}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="mb-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-400"
        />

        <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.modeLabel}
        </span>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode(RunMode.SOULLINK)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              mode === RunMode.SOULLINK
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {t.modeSoullink}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode(RunMode.CLASSIC)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              mode === RunMode.CLASSIC
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {t.modeClassic}
          </button>
        </div>

        <div className="flex justify-end gap-2">
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
            disabled={pending || !name.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t.create}
          </button>
        </div>
      </form>
    </div>
  );
}
