"use client";

import type { Route, Pokemon } from "@/lib/data";
import type { Encounter } from "@/generated/prisma/client";
import { Player } from "@/generated/prisma/enums";
import { EncounterEditor } from "@/components/EncounterEditor";

export function TrackerView({
  runId,
  routes,
  pokemonList,
  encounters,
}: {
  runId: number;
  routes: Route[];
  pokemonList: Pokemon[];
  encounters: Encounter[];
}) {
  return (
    <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {routes.map((route) => (
        <div
          key={route.id}
          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4"
        >
          <div className="shrink-0 pt-1.5 sm:w-40">
            <span className="font-medium">{route.name}</span>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Spieler 1
              </span>
              <EncounterEditor
                runId={runId}
                routeId={route.id}
                player={Player.PLAYER1}
                pokemonList={pokemonList}
                encounters={encounters}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Spieler 2
              </span>
              <EncounterEditor
                runId={runId}
                routeId={route.id}
                player={Player.PLAYER2}
                pokemonList={pokemonList}
                encounters={encounters}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
