"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { LinkStatus } from "@/generated/prisma/enums";
import { markDead, markAlive } from "@/lib/actions";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { EvolveButton, RevertButton } from "@/components/EvolveControls";

const STATUS_LABELS_DE: Record<string, string> = {
  CAUGHT: "Gefangen",
  KILLED: "Getötet",
  FLED: "Geflohen",
};

const PLAYER_LABELS: Record<string, string> = {
  PLAYER1: "Spieler 1",
  PLAYER2: "Spieler 2",
};

export function LinksView({ runId, soulLinks }: { runId: number; soulLinks: SoulLinkView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function handleMarkDead(id: number) {
    setPendingId(id);
    startTransition(async () => {
      await markDead(runId, id);
      router.refresh();
      setPendingId(null);
    });
  }

  function handleMarkAlive(id: number) {
    setPendingId(id);
    startTransition(async () => {
      await markAlive(runId, id);
      router.refresh();
      setPendingId(null);
    });
  }

  if (soulLinks.length === 0) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400">
        Noch keine SoulLinks – fange im Tracker-Tab dein erstes Pokémon.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {soulLinks.map((link) => {
        const isDead = link.status === LinkStatus.DEAD;
        const paired = link.encounters.length > 1;
        return (
          <div
            key={link.id}
            className={`rounded-lg border p-4 ${
              isDead
                ? "border-red-200 bg-red-50/50 opacity-60 dark:border-red-900/50 dark:bg-red-950/20"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">{link.routeName}</h3>
              {isDead ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-500 dark:text-red-400">
                    Tot
                  </span>
                  <button
                    type="button"
                    disabled={pendingId === link.id}
                    onClick={() => handleMarkAlive(link.id)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Wiederbeleben
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === link.id}
                  onClick={() => handleMarkDead(link.id)}
                  className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Als tot markieren
                </button>
              )}
            </div>
            <div className={paired ? "grid grid-cols-2 gap-3" : "flex justify-center"}>
              {link.encounters.map((e) => (
                <div
                  key={e.id}
                  className="flex w-full max-w-[160px] flex-col items-center gap-1 text-center"
                >
                  <PokemonSprite pokemonId={e.pokemonId} name={e.pokemonName} size="xl" />
                  <span
                    className={`font-medium ${
                      isDead ? "text-zinc-400 line-through dark:text-zinc-600" : ""
                    }`}
                  >
                    {e.pokemonName}
                  </span>
                  <div className="flex flex-wrap justify-center gap-1">
                    {e.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {PLAYER_LABELS[e.player]} · {STATUS_LABELS_DE[e.status]}
                    {e.isStatic ? " · statisch" : ""}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    Rang #{e.rang} · Summe {e.summe}
                  </span>
                  {!isDead && (
                    <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                      <EvolveButton runId={runId} encounterId={e.id} targets={e.evolvesTo} />
                      {e.evolvesFrom && <RevertButton runId={runId} encounterId={e.id} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
