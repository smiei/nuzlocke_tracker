"use client";

import { useEffect, useState } from "react";
import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import {
  computeDefenseMultipliers,
  getTypesForGeneration,
  singleTypeMultiplier,
} from "@/lib/effectiveness";
import { TYPE_COLORS, TYPE_LABELS, typesForGeneration } from "@/lib/pokemonTypes";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { localizeName, type LocalizedNames } from "@/lib/i18n/localize";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { TypeBadge } from "@/components/TypeBadge";

export type TypeChartGame = {
  id: string;
  names: LocalizedNames;
  dexLimit: number;
  generation: number;
  spriteSet: string;
};

// Same per-device preference as the Pokédex table - picking a game on one
// static page carries over to the other.
const GAME_STORAGE_KEY = "nuzlocke:pokedexGame";

const EMPTY_LOCKS = new Set<number>();

const MULTIPLIER_GROUPS = [4, 2, 0.5, 0.25, 0] as const;

function TypeAbbrev({ type, lang, dimmed }: { type: string; lang: Lang; dimmed: boolean }) {
  const label = TYPE_LABELS[lang][type] ?? type;
  return (
    <span
      title={label}
      className={`inline-flex h-7 w-8 items-center justify-center rounded text-[10px] font-semibold uppercase text-white transition-opacity ${
        dimmed ? "opacity-25" : ""
      }`}
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {label.slice(0, 3)}
    </span>
  );
}

function matrixCellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 2) return { text: "2", className: "bg-green-500 text-white dark:bg-green-600" };
  if (multiplier === 0.5) return { text: "½", className: "bg-red-500 text-white dark:bg-red-600" };
  if (multiplier === 0) return { text: "0", className: "bg-zinc-900 text-zinc-100 dark:bg-black dark:text-zinc-400" };
  return { text: "", className: "bg-zinc-100 dark:bg-zinc-800/60" };
}

export function TypeEffectivenessView({
  pokemonList: allPokemon,
  games,
  tables,
}: {
  pokemonList: Pokemon[];
  games: TypeChartGame[];
  // Gen 1 has its own chart; gens 2-5 share the standard one.
  tables: { gen1: EffectivenessTable; standard: EffectivenessTable };
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  useEffect(() => {
    const stored = localStorage.getItem(GAME_STORAGE_KEY);
    if (stored && games.some((g) => g.id === stored)) setGameId(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGameChange(next: string) {
    setGameId(next);
    localStorage.setItem(GAME_STORAGE_KEY, next);
  }

  const game = games.find((g) => g.id === gameId) ?? games[0];
  const generation = game?.generation ?? 3;
  const table = generation === 1 ? tables.gen1 : tables.standard;
  const typeList = getTypesForGeneration(generation);
  // Plain filter per render - the React Compiler memoizes this on its own
  // (a manual useMemo here defeats its analysis and gets flagged).
  const dexLimit = game?.dexLimit ?? Infinity;
  const pokemonList = allPokemon.filter((p) => p.id <= dexLimit);

  const selectedRaw = pokemonList.find((p) => p.id === selectedId) ?? null;
  const selected = selectedRaw
    ? { ...selectedRaw, types: typesForGeneration(selectedRaw.id, selectedRaw.types, generation) }
    : null;

  // Cheap enough (17x2 lookups) to compute per render.
  const multipliers = selected
    ? computeDefenseMultipliers(table, selected.types, typeList)
    : null;

  const groupLabels: Record<(typeof MULTIPLIER_GROUPS)[number], string> = {
    4: t.weak4,
    2: t.weak2,
    0.5: t.resist2,
    0.25: t.resist4,
    0: t.immune,
  };

  const defenderTypes = selected?.types ?? null;
  const isDimmed = (defenseType: string) =>
    defenderTypes !== null && !defenderTypes.includes(defenseType);

  return (
    <SpriteSetProvider spriteSet={game?.spriteSet ?? "emerald"}>
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.heading}</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={gameId}
          onChange={(e) => handleGameChange(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {localizeName(g.names, lang)}
            </option>
          ))}
        </select>
        <div className="max-w-sm flex-1">
          <PokemonCombobox
            lang={lang}
            pokemonList={pokemonList}
            selectedId={selected ? selectedId : null}
            onSelect={setSelectedId}
            lockedFamilyIds={EMPTY_LOCKS}
          />
        </div>
      </div>

      {multipliers === null ? (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{t.hint}</p>
      ) : (
        <div className="mb-6 max-w-xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-col gap-2.5">
            {MULTIPLIER_GROUPS.map((group) => {
              const types = typeList.filter((attack) => multipliers[attack] === group);
              if (types.length === 0) return null;
              return (
                <div key={group} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-56 shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    {groupLabels[group]}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {types.map((type) => (
                      <TypeBadge key={type} type={type} lang={lang} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="pr-2 text-right align-bottom">
                <div className="text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
                  <div>{t.defense} →</div>
                  <div>{t.attack} ↓</div>
                </div>
              </th>
              {typeList.map((defense) => (
                <th key={defense} className="p-0">
                  <TypeAbbrev type={defense} lang={lang} dimmed={isDimmed(defense)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typeList.map((attack) => (
              <tr key={attack}>
                <th className="p-0 pr-1 text-right">
                  <TypeAbbrev type={attack} lang={lang} dimmed={false} />
                </th>
                {typeList.map((defense) => {
                  const { text, className } = matrixCellStyle(
                    singleTypeMultiplier(table, attack, defense),
                  );
                  return (
                    <td
                      key={defense}
                      className={`h-7 w-8 rounded text-center text-xs font-semibold transition-opacity ${className} ${
                        isDimmed(defense) ? "opacity-25" : ""
                      }`}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </SpriteSetProvider>
  );
}
