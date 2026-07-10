"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Pokemon, Route } from "@/lib/data";
import type { Encounter } from "@/generated/prisma/client";
import { EncounterStatus, type Player } from "@/generated/prisma/enums";
import { saveEncounter } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName, routeName } from "@/lib/i18n/localize";
import { PokemonCombobox } from "@/components/PokemonCombobox";

export function EncounterEditor({
  runId,
  lang,
  routeId,
  player,
  routes,
  pokemonList,
  encounters,
}: {
  runId: number;
  lang: Lang;
  routeId: number;
  player: Player;
  routes: Route[];
  pokemonList: Pokemon[];
  encounters: Encounter[];
}) {
  const router = useRouter();
  const t = translations[lang];

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
    const evolved = pokemonList.find((p) => p.id === current.currentPokemonId);
    return evolved ? pokemonName(evolved, lang) : null;
  }, [current, pokemonList, lang]);

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

  // Purely informational Species Clause warning, derived from the run's
  // encounters: the pick is SAVED either way (the server never rejects it).
  // Disappears when "Static" is ticked (statics are exempt) or the conflict
  // elsewhere goes away.
  const lockWarning = useMemo(() => {
    if (selectedId === null || isStatic) return null;
    const picked = pokemonList.find((p) => p.id === selectedId);
    if (!picked) return null;
    const conflict = encounters.find(
      (e) =>
        !e.isStatic &&
        e.familyId === picked.family_id &&
        !(e.routeId === routeId && e.player === player),
    );
    if (!conflict) return null;
    const conflictRoute = routes.find((r) => r.id === conflict.routeId);
    return t.actions.speciesLocked(
      pokemonName(picked, lang),
      t.player[conflict.player],
      conflictRoute ? routeName(conflictRoute, lang) : `Route #${conflict.routeId}`,
    );
  }, [selectedId, isStatic, encounters, routeId, player, pokemonList, routes, lang, t]);

  function persist(next: { pokemonId: number; status: EncounterStatus; isStatic: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await saveEncounter({ runId, routeId, player, ...next });
      if (result.success) {
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
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
        lang={lang}
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
                {t.status[s]}
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
            {t.tracker.isStatic}
          </label>
        </div>
      )}
      {lockWarning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {lockWarning}</p>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
