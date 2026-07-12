"use client";

import { useEffect } from "react";
import type { Pokemon, EvolutionEntry } from "@/lib/data";
import type { Learnset } from "@/lib/learnset";
import { attackTypesAtLevel } from "@/lib/learnset";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { formatEvolutionMethod } from "@/lib/evolutionMethods";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";

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
  learnset,
  generation,
  dexLimit,
  lang,
  onClose,
}: {
  pokemon: Pokemon;
  allPokemon: Pokemon[];
  evolutions: EvolutionEntry[];
  learnset: Learnset;
  generation: number;
  dexLimit: number;
  lang: Lang;
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
  const attacks = attackTypesAtLevel(learnset, pokemon.id, 100);

  const evoById = new Map(evolutions.map((e) => [e.id, e]));
  const entry = evoById.get(pokemon.id);
  const preEvoId =
    entry?.evolvesFrom != null && entry.evolvesFrom <= dexLimit ? entry.evolvesFrom : null;
  const evolvesTo = (entry?.evolvesTo ?? [])
    .filter((id) => id <= dexLimit)
    .map((id) => ({
      id,
      name: nameOf(id),
      method: evoById.get(id)?.method ? formatEvolutionMethod(evoById.get(id)!.method!, lang) : null,
    }));

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
          </div>
        </div>

        {/* Attack types by level */}
        {attacks.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {td.moves}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {attacks.map(({ type, level }) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <TypeBadge type={type} lang={lang} />
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {td.level(level)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Evolution */}
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {td.evolution}
          </h3>
          {preEvoId === null && evolvesTo.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{td.noEvolution}</p>
          ) : (
            <div className="space-y-1 text-sm">
              {preEvoId !== null && (
                <div className="text-zinc-500 dark:text-zinc-400">
                  {td.evolvesFrom}: <span className="font-medium text-zinc-700 dark:text-zinc-200">{nameOf(preEvoId)}</span>
                </div>
              )}
              {evolvesTo.map((child) => (
                <div key={child.id}>
                  <span className="text-zinc-400 dark:text-zinc-500">→ </span>
                  <span className="font-medium">{child.name}</span>
                  {child.method && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400"> ({child.method})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
