"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createRun } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { localizeName } from "@/lib/i18n/localize";
import { RunMode } from "@/generated/prisma/enums";
import type { GameSummary, RunSummary } from "@/lib/types";
import { NewRunDialog } from "@/components/NewRunDialog";
import { useToast } from "@/components/ui/ToastProvider";

// Run select + a compact "+" (new run). Rename/delete live in the header
// menu (HeaderMenu) to keep this bar narrow on phones.
export function RunSwitcher({ runs, games }: { runs: RunSummary[]; games: GameSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { lang } = useLanguage();
  const toast = useToast();
  const t = translations[lang].runSwitcher;

  const activeId = Number(searchParams.get("run")) || runs[0]?.id;
  const activeRun = runs.find((r) => r.id === activeId);
  // games[0] is the default pack - only non-default games get a suffix in
  // the dropdown, so the common case stays short.
  const defaultGameId = games[0]?.id;

  function gameSuffix(run: RunSummary): string {
    if (run.gameId === defaultGameId) return "";
    const game = games.find((g) => g.id === run.gameId);
    return game ? ` · ${localizeName(game.names, lang)}` : "";
  }

  function handleChange(value: string) {
    router.push(`${pathname}?run=${value}`);
  }

  function handleCreate(name: string, mode: RunMode, gameId: string) {
    startTransition(async () => {
      // Inherit ruleset + rule toggles from the run that's on screen right
      // now, then land on the Rules tab so they can be reviewed first.
      const result = await createRun(name, mode, activeId ?? null, gameId, lang);
      if (result.success) {
        setDialogOpen(false);
        router.push(`/rules?run=${result.runId}`);
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
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
            {gameSuffix(run)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => setDialogOpen(true)}
        aria-label={t.newRunTitle}
        title={t.newRunTitle}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-lg font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        +
      </button>
      <NewRunDialog
        lang={lang}
        open={dialogOpen}
        pending={pending}
        games={games}
        initialGameId={activeRun?.gameId ?? defaultGameId ?? ""}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
