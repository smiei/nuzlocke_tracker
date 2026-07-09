"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { Encounter } from "@/generated/prisma/client";
import { EncounterStatus, type Player } from "@/generated/prisma/enums";
import { saveEncounter } from "@/lib/actions";
import { PokemonCombobox } from "@/components/PokemonCombobox";

const STATUS_LABELS: Record<EncounterStatus, string> = {
  CAUGHT: "Gefangen",
  KILLED: "Getötet",
  FLED: "Geflohen",
};

export function EncounterEditor({
  runId,
  routeId,
  player,
  pokemonList,
  encounters,
}: {
  runId: number;
  routeId: number;
  player: Player;
  pokemonList: Pokemon[];
  encounters: Encounter[];
}) {
  const router = useRouter();

  const current = useMemo(
    () => encounters.find((e) => e.routeId === routeId && e.player === player),
    [encounters, routeId, player],
  );

  // Every non-static encounter elsewhere already "uses up" its family_id,
  // except this exact slot (so re-saving the same pick doesn't lock itself).
  const lockedFamilyIds = useMemo(() => {
    const set = new Set<number>();
    for (const e of encounters) {
      if (e.isStatic) continue;
      if (e.routeId === routeId && e.player === player) continue;
      set.add(e.familyId);
    }
    return set;
  }, [encounters, routeId, player]);

  // Tracker always shows what was actually caught (pokemonId); if it has
  // since been evolved in the Links tab (currentPokemonId), name that form
  // in parentheses alongside it, without ever changing the selection here.
  const evolvedName = useMemo(() => {
    if (!current || current.currentPokemonId === current.pokemonId) return null;
    return pokemonList.find((p) => p.id === current.currentPokemonId)?.name_de ?? null;
  }, [current, pokemonList]);

  const [selectedId, setSelectedId] = useState<number | null>(current?.pokemonId ?? null);
  const [status, setStatus] = useState<EncounterStatus>(current?.status ?? EncounterStatus.CAUGHT);
  const [isStatic, setIsStatic] = useState<boolean>(current?.isStatic ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedId(current?.pokemonId ?? null);
    setStatus(current?.status ?? EncounterStatus.CAUGHT);
    setIsStatic(current?.isStatic ?? false);
  }, [current?.pokemonId, current?.status, current?.isStatic]);

  function persist(next: { pokemonId: number; status: EncounterStatus; isStatic: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await saveEncounter({ runId, routeId, player, ...next });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
        // Revert the optimistic UI change - the save was rejected server-side.
        setSelectedId(current?.pokemonId ?? null);
        setStatus(current?.status ?? EncounterStatus.CAUGHT);
        setIsStatic(current?.isStatic ?? false);
      }
    });
  }

  function handleSelectPokemon(pokemonId: number) {
    setSelectedId(pokemonId);
    persist({ pokemonId, status, isStatic });
  }

  function handleStatusChange(next: EncounterStatus) {
    setStatus(next);
    if (selectedId !== null) persist({ pokemonId: selectedId, status: next, isStatic });
  }

  function handleStaticChange(next: boolean) {
    setIsStatic(next);
    if (selectedId !== null) persist({ pokemonId: selectedId, status, isStatic: next });
  }

  return (
    <div className="flex min-w-[200px] flex-col gap-1.5">
      <PokemonCombobox
        pokemonList={pokemonList}
        selectedId={selectedId}
        onSelect={handleSelectPokemon}
        lockedFamilyIds={lockedFamilyIds}
        disabled={pending}
      />
      {evolvedName && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">({evolvedName})</span>
      )}
      {selectedId !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={status}
            disabled={pending}
            onChange={(e) => handleStatusChange(e.target.value as EncounterStatus)}
            className="rounded border border-zinc-300 bg-white px-1.5 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.values(EncounterStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={isStatic}
              disabled={pending}
              onChange={(e) => handleStaticChange(e.target.checked)}
            />
            Statisch (NPC)
          </label>
        </div>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
