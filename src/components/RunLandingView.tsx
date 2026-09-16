"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRun } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { translations, type Lang } from "@/lib/i18n/dictionary";
import type { RunMode } from "@/generated/prisma/enums";
import type { GameSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Page";
import { NewRunDialog } from "@/components/NewRunDialog";
import { useToast } from "@/components/ui/ToastProvider";

// What a public instance shows instead of a tab when this browser holds no run
// key at all: no run is ever picked for a stranger.
export function RunLandingView({ lang, games }: { lang: Lang; games: GameSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const t = translations[lang].landing;

  function handleCreate(name: string, mode: RunMode, gameId: string, playerCount: number) {
    startTransition(async () => {
      const result = await createRun(name, mode, null, gameId, lang, playerCount);
      if (result.success) {
        setDialogOpen(false);
        router.push(`/rules?run=${result.runKey}`);
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div>
      <PageHeader title={t.title} />
      <EmptyState
        title={t.empty}
        hint={t.hint}
        action={
          <Button variant="primary" loading={pending} onClick={() => setDialogOpen(true)}>
            {t.create}
          </Button>
        }
      />
      <p className="mx-auto mt-4 max-w-prose text-center text-xs text-ink-subtle">{t.linkNote}</p>
      <NewRunDialog
        lang={lang}
        open={dialogOpen}
        pending={pending}
        games={games}
        initialGameId={games[0]?.id ?? ""}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
