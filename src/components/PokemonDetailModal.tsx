"use client";

import { useEffect, type ReactNode } from "react";
import type { Pokemon, EvolutionEntry } from "@/lib/data";
import type { Moveset, MovesTable } from "@/lib/learnset";
import { moveListAtLevel } from "@/lib/learnset";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { computeDefenseMultipliers, getTypesForGeneration } from "@/lib/effectiveness";
import { computePokemonRanks } from "@/lib/ranking";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { formatEvolutionMethod } from "@/lib/evolutionMethods";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";

const WEAKNESS_GROUPS = [4, 2, 0.5, 0.25, 0] as const;

// Order + label keys for the six base stats (matching pokedex.columns).
const STAT_ROWS: { key: keyof Pokemon["stats"]; labelKey: "kp" | "ang" | "vert" | "spA" | "spV" | "init" }[] = [
  { key: "KP", labelKey: "kp" },
  { key: "Ang.", labelKey: "ang" },
  { key: "Vert.", labelKey: "vert" },
  { key: "Sp.-A.", labelKey: "spA" },
  { key: "Sp.-V.", labelKey: "spV" },
  { key: "Init.", labelKey: "init" },
];

function statColor(value: number): string {
  if (value >= 120) return "bg-emerald-500";
  if (value >= 90) return "bg-green-500";
  if (value >= 60) return "bg-amber-400";
  if (value >= 40) return "bg-orange-400";
  return "bg-red-400";
}

export function PokemonDetailModal({
  pokemon,
  allPokemon,
  evolutions,
  movesets,
  moves,
  effectiveness,
  generation,
  dexLimit,
  lang,
  onSelect,
  onClose,
}: {
  pokemon: Pokemon;
  allPokemon: Pokemon[];
  evolutions: EvolutionEntry[];
  movesets: Moveset;
  moves: MovesTable;
  effectiveness: EffectivenessTable;
  generation: number;
  dexLimit: number;
  lang: Lang;
  // Opens the card for another Pokémon (evolution links) - replaces this same
  // single modal instance, so no duplicate cards ever stack up.
  onSelect: (pokemonId: number) => void;
  onClose: () => void;
}) {
  const t = translations[lang];
  const td = t.pokedex.detail;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameOf = (id: number) => {
    const p = allPokemon.find((x) => x.id === id);
    return p ? pokemonName(p, lang) : `#${id}`;
  };

  const types = typesForGeneration(pokemon.id, pokemon.types, generation);
  const moveList = moveListAtLevel(movesets, moves, pokemon.id, 100, lang);
  const maxBST = generation >= 4 ? 720 : 680;
  const rank = computePokemonRanks(allPokemon).get(pokemon.id) ?? 0;

  // Defensive type matchups (gen-corrected types + gen-appropriate chart).
  const defMult = computeDefenseMultipliers(effectiveness, types, getTypesForGeneration(generation));
  const weaknessGroups = WEAKNESS_GROUPS.map((g) => ({
    mult: g,
    label: { 4: t.typen.weak4, 2: t.typen.weak2, 0.5: t.typen.resist2, 0.25: t.typen.resist4, 0: t.typen.immune }[g],
    types: getTypesForGeneration(generation).filter((ty) => defMult[ty] === g),
  })).filter((row) => row.types.length > 0);

  const evoById = new Map(evolutions.map((e) => [e.id, e]));
  // Walk up to the family's root, then render the whole tree (Eevee & co.
  // branch, so it's a tree, not a chain). Each node shows how it evolves from
  // its parent. dexLimit keeps stages that don't exist in this game out.
  let rootId = pokemon.id;
  for (let guard = 0; guard < 10; guard++) {
    const from = evoById.get(rootId)?.evolvesFrom;
    if (from == null || from > dexLimit) break;
    rootId = from;
  }
  const familyHasEvolution =
    rootId !== pokemon.id ||
    (evoById.get(pokemon.id)?.evolvesTo ?? []).some((id) => id <= dexLimit);

  // Plain recursive render function (not a nested component - that trips the
  // React compiler). A node's method is how IT evolves from its pre-evo.
  const renderEvoNode = (id: number, depth: number): ReactNode => {
    const e = evoById.get(id);
    const method = depth > 0 && e?.method ? formatEvolutionMethod(e.method, lang) : null;
    const children = (e?.evolvesTo ?? []).filter((c) => c <= dexLimit);
    const isCurrent = id === pokemon.id;
    return (
      <div key={id}>
        <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: depth * 16 }}>
          {depth > 0 && <span className="text-zinc-300 dark:text-zinc-600">↳</span>}
          {isCurrent ? (
            <span className="flex items-center gap-1.5">
              <PokemonSprite pokemonId={id} name={nameOf(id)} size="sm" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {nameOf(id)}
              </span>
            </span>
          ) : (
            // Clicking another family member reopens the (single) card for it.
            <button
              type="button"
              onClick={() => onSelect(id)}
              className="flex items-center gap-1.5 rounded px-1 -mx-1 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <PokemonSprite pokemonId={id} name={nameOf(id)} size="sm" />
              <span className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300">
                {nameOf(id)}
              </span>
            </button>
          )}
          {method && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">({method})</span>
          )}
        </div>
        {children.map((c) => renderEvoNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-3 flex items-start gap-3">
          <PokemonSprite pokemonId={pokemon.id} name={pokemonName(pokemon, lang)} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{pokemonName(pokemon, lang)}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.dialog.cancel}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              #{String(pokemon.id).padStart(3, "0")}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {types.map((type) => (
                <TypeBadge key={type} type={type} lang={lang} />
              ))}
            </div>
          </div>
        </div>

        {/* Rank + type weaknesses */}
        <div className="mb-4 space-y-2">
          <div className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {td.rank}:{" "}
            </span>
            <span className="font-semibold">#{rank}</span>
          </div>
          {weaknessGroups.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {td.weaknesses}
              </h3>
              <div className="flex flex-col gap-1">
                {weaknessGroups.map((row) => (
                  <div key={row.mult} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="w-28 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {row.label}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {row.types.map((type) => (
                        <TypeBadge key={type} type={type} lang={lang} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Base stats */}
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {td.stats}
        </h3>
        <div className="mb-4 space-y-1">
          {STAT_ROWS.map(({ key, labelKey }) => {
            const value = pokemon.stats[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {t.pokedex.columns[labelKey]}
                </span>
                <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {value}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span
                    className={`block h-full rounded-full ${statColor(value)}`}
                    style={{ width: `${Math.min(100, (value / 200) * 100)}%` }}
                  />
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="w-14 shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {t.pokedex.columns.summe}
            </span>
            <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums">
              {pokemon.stats.Summe}
            </span>
            {/* BST scaled to the generation's cap (720 from Gen 4, else 680). */}
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span
                className="block h-full rounded-full bg-zinc-500 dark:bg-zinc-400"
                style={{ width: `${Math.min(100, (pokemon.stats.Summe / maxBST) * 100)}%` }}
              />
            </span>
          </div>
        </div>

        {/* Evolution */}
        <div className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {td.evolution}
          </h3>
          {!familyHasEvolution ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{td.noEvolution}</p>
          ) : (
            <div>{renderEvoNode(rootId, 0)}</div>
          )}
        </div>

        {/* Full level-up move list (bottom) */}
        {moveList.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {td.moves}
            </h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {moveList.map((mv, i) => (
                <div key={`${mv.name}-${i}`} className="flex items-center gap-2 py-1 text-sm">
                  <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                    {td.level(mv.level)}
                  </span>
                  <TypeBadge type={mv.type} lang={lang} />
                  <span className={mv.damaging ? "" : "text-zinc-500 dark:text-zinc-400"}>
                    {mv.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
