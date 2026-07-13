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
import { PokemonInfoButton } from "@/components/PokemonDetailProvider";
import type { RunSettings } from "@/lib/runSettings";

// Colour the status control so a route's outcome is readable at a glance:
// green = caught, red = killed, amber = fled.
const STATUS_STYLES: Record<EncounterStatus, string> = {
  CAUGHT:
    "border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-300",
  KILLED:
    "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
  FLED: "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
};

export function EncounterEditor({
  runId,
  lang,
  settings,
  routeId,
  player,
  routes,
  pokemonList,
  encounters,
}: {
  runId: number;
  lang: Lang;
  settings: RunSettings;
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

  // EVERY encounter elsewhere - static or not, regardless of outcome
  // (caught/killed/fled) - "uses up" its family_id. Only this exact slot is
  // excluded, so re-saving the same pick doesn't mark itself. Locked families
  // are marked in the dropdown on every route, including static ones (static
  // only means "safe to pick anyway", not "not locked"). With the Species
  // Clause rule off, nothing is marked at all.
  const lockedFamilyIds = useMemo(() => {
    const set = new Set<number>();
    if (!settings.speciesClause) return set;
    for (const e of encounters) {
      if (e.routeId === routeId && e.player === player) continue;
      set.add(e.familyId);
    }
    return set;
  }, [settings.speciesClause, encounters, routeId, player]);

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
  const [nickname, setNickname] = useState(current?.nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedName = (() => {
    const p = selectedId != null ? pokemonList.find((x) => x.id === selectedId) : null;
    return p ? pokemonName(p, lang) : "";
  })();

  useEffect(() => {
    setSelectedId(current?.pokemonId ?? null);
    setStatus(current?.status ?? EncounterStatus.CAUGHT);
    setNickname(current?.nickname ?? "");
  }, [current?.pokemonId, current?.status, current?.nickname]);

  // Static/gift is a fixed property of the location (routes.json `type`),
  // no longer a user-set checkbox.
  const routeIsStatic = (routes.find((r) => r.id === routeId)?.type ?? "route") !== "route";

  // Purely informational Species Clause warning, derived from the run's
  // encounters: the pick is SAVED either way (the server never rejects it).
  // Conflicts count ALL other entries of the family, including statics.
  // Static routes themselves never warn ("safe to pick anyway") - unless the
  // staticsExemptFromClause rule is switched off. On normal routes the
  // warning shows on BOTH sides of a conflict for as long as it exists - a
  // deliberate, stateless rule (no "who was first" timestamp heuristics that
  // could flip when entries are edited later).
  const lockWarning = useMemo(() => {
    if (!settings.speciesClause || selectedId === null) return null;
    if (routeIsStatic && settings.staticsExemptFromClause) return null;
    const picked = pokemonList.find((p) => p.id === selectedId);
    if (!picked) return null;
    const conflict = encounters.find(
      (e) => e.familyId === picked.family_id && !(e.routeId === routeId && e.player === player),
    );
    if (!conflict) return null;
    const conflictRoute = routes.find((r) => r.id === conflict.routeId);
    return t.actions.speciesLocked(
      pokemonName(picked, lang),
      t.player[conflict.player],
      conflictRoute ? routeName(conflictRoute, lang) : `Route #${conflict.routeId}`,
    );
  }, [settings, selectedId, routeIsStatic, encounters, routeId, player, pokemonList, routes, lang, t]);

  function persist(next: {
    pokemonId: number;
    status: EncounterStatus;
    nickname?: string | null;
  }) {
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
        setNickname(current?.nickname ?? "");
      }
    });
  }

  function handleSelectPokemon(pokemonId: number) {
    setSelectedId(pokemonId);
    if (pokemonId !== current?.pokemonId) {
      // A different species = a different individual - its nickname doesn't
      // carry over. Re-picking the same species keeps it.
      setNickname("");
      persist({ pokemonId, status, nickname: null });
    } else {
      persist({ pokemonId, status });
    }
  }

  function handleStatusChange(next: EncounterStatus) {
    setStatus(next);
    if (selectedId !== null) persist({ pokemonId: selectedId, status: next });
  }

  // Saved on blur / Enter, not per keystroke - one server action per edit.
  function commitNickname() {
    if (selectedId === null) return;
    const trimmed = nickname.trim();
    if (trimmed === (current?.nickname ?? "")) return;
    persist({ pokemonId: selectedId, status, nickname: trimmed || null });
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
          <PokemonInfoButton pokemonId={selectedId} label={selectedName} />
          <select
            value={status}
            disabled={pending}
            onChange={(e) => handleStatusChange(e.target.value as EncounterStatus)}
            className={`rounded border px-1.5 py-1 font-medium disabled:opacity-50 ${STATUS_STYLES[status]}`}
          >
            {Object.values(EncounterStatus).map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
          {settings.nicknames && (
            <input
              type="text"
              value={nickname}
              disabled={pending}
              maxLength={20}
              placeholder={t.tracker.nicknamePlaceholder}
              aria-label={t.tracker.nicknameLabel}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={commitNickname}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-28 rounded border border-zinc-300 bg-white px-1.5 py-1 outline-none placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:border-zinc-400"
            />
          )}
        </div>
      )}
      {lockWarning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {lockWarning}</p>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
