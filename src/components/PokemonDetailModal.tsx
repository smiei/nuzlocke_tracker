"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Pokemon, EvolutionEntry } from "@/lib/data";
import type { MoveEntry, Moveset, MovesTable, MoveTypeHistoryEntry } from "@/lib/learnset";
import { moveListAtLevel } from "@/lib/learnset";
import { MoveDetailPanel } from "@/components/MoveDetailPanel";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { getTypesForGeneration } from "@/lib/effectiveness";
import { computePokemonRanks, rankForSumme } from "@/lib/ranking";
import { baseSpeciesId, formLabel, formsOfSpecies, movepoolId } from "@/lib/forms";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { formatEvolutionMethod } from "@/lib/evolutionMethods";
import { TypeBadge } from "@/components/TypeBadge";
import { TypeEffectiveness } from "@/components/ui/TypeEffectiveness";
import { PokemonSprite } from "@/components/PokemonSprite";

// Order + label keys for the base stats (matching pokedex.columns).
type StatRow = {
  key: keyof Pokemon["stats"];
  labelKey: "kp" | "ang" | "vert" | "spA" | "spV" | "spez" | "init";
};

const STAT_ROWS: StatRow[] = [
  { key: "KP", labelKey: "kp" },
  { key: "Ang.", labelKey: "ang" },
  { key: "Vert.", labelKey: "vert" },
  { key: "Sp.-A.", labelKey: "spA" },
  { key: "Sp.-V.", labelKey: "spV" },
  { key: "Init.", labelKey: "init" },
];

// Gen 1 had a single Special stat instead of the attack/defence pair, so a
// Gen-1 game shows five rows. `Spezial` is only ever set by
// pokemonForGeneration for generation 1, which makes it the switch.
const STAT_ROWS_GEN1: StatRow[] = [
  { key: "KP", labelKey: "kp" },
  { key: "Ang.", labelKey: "ang" },
  { key: "Vert.", labelKey: "vert" },
  { key: "Spezial", labelKey: "spez" },
  { key: "Init.", labelKey: "init" },
];

function statColor(value: number): string {
  if (value >= 120) return "bg-emerald-500";
  if (value >= 90) return "bg-green-500";
  if (value >= 60) return "bg-amber-400";
  if (value >= 40) return "bg-orange-400";
  return "bg-red-400";
}

// One headline figure above the stat bars (rank / BST / weight).
function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-100 px-1.5 py-1.5 text-center dark:bg-zinc-800/60">
      <div className="truncate text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

// A module-scope component (not an inline closure inside the modal's render
// body) because each row owns its expanded state - an inline
// function-as-component would remount and collapse on every parent render,
// and nested components trip the React compiler here.
function MoveRow({ move, lang }: { move: MoveEntry; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const td = translations[lang].pokedex.detail;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={td.moveDetails}
        className="flex w-full items-center gap-2 rounded px-1 -mx-1 py-1 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="w-10 shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {td.level(move.level)}
        </span>
        <TypeBadge type={move.type} lang={lang} />
        <span className={`flex-1 ${move.damaging ? "" : "text-zinc-500 dark:text-zinc-400"}`}>
          {move.name}
        </span>
        <span
          className={`shrink-0 text-xs text-zinc-400 transition-transform dark:text-zinc-500 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▸
        </span>
      </button>
      {open && <MoveDetailPanel move={move} lang={lang} className="mb-1.5 ml-12" />}
    </div>
  );
}

export function PokemonDetailModal({
  pokemon,
  allPokemon,
  forms = [],
  evolutions,
  movesets,
  moves,
  moveTypeHistory,
  effectiveness,
  generation,
  dexLimit,
  lang,
  onSelect,
  onClose,
}: {
  pokemon: Pokemon;
  allPokemon: Pokemon[];
  forms?: Pokemon[];
  evolutions: EvolutionEntry[];
  movesets: Moveset;
  moves: MovesTable;
  moveTypeHistory: MoveTypeHistoryEntry[];
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
  const searchParams = useSearchParams();

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

  // Jump to the Battle & Catch tab with this Pokémon already picked (see the
  // ?pokemon= handling in AnalyzeView), carrying the current run along.
  const runParam = searchParams.get("run");
  const analyzeHref = `/typen?${runParam ? `run=${runParam}&` : ""}pokemon=${pokemon.id}`;

  const types = pokemon.types;
  // The evolution tree is keyed by SPECIES, so a forme resolves to its base.
  // The MOVEPOOL is not: Deoxys/Wormadam/Shaymin learn different moves per
  // forme, so prefer the forme's own rows and fall back only when it has none.
  const speciesId = baseSpeciesId(pokemon);
  const moveList = moveListAtLevel(
    movesets,
    moves,
    movepoolId(pokemon, (id) => movesets[String(id)] !== undefined),
    100,
    lang,
    generation,
    moveTypeHistory,
  );
  const maxBST = generation >= 4 ? 720 : 680;
  // A forme is ranked against the species by its own BST rather than joining
  // the pool - see rankForSumme.
  const rank =
    computePokemonRanks(allPokemon).get(pokemon.id) ??
    rankForSumme(allPokemon, pokemon.stats.Summe);
  const formOptions = formsOfSpecies(speciesId, allPokemon, forms);

  // Defensive type matchups (gen-corrected types + gen-appropriate chart).

  const evoById = new Map(evolutions.map((e) => [e.id, e]));
  // Walk up to the family's root, then render the whole tree (Eevee & co.
  // branch, so it's a tree, not a chain). Each node shows how it evolves from
  // its parent. dexLimit keeps stages that don't exist in this game out.
  let rootId = speciesId;
  for (let guard = 0; guard < 10; guard++) {
    const from = evoById.get(rootId)?.evolvesFrom;
    if (from == null || from > dexLimit) break;
    rootId = from;
  }
  const familyHasEvolution =
    rootId !== speciesId ||
    (evoById.get(speciesId)?.evolvesTo ?? []).some((id) => id <= dexLimit);

  // Rendered as generations rather than an indented tree: each stage is one
  // wrapping row of tiles, so a branching family (Eevee) stays compact
  // instead of turning into a tall ladder, and the condition gets its own
  // line under the name rather than eating width beside it.
  const evoStages: number[][] = [];
  for (let ids = [rootId], guard = 0; ids.length > 0 && guard < 6; guard++) {
    evoStages.push(ids);
    ids = ids.flatMap((id) => (evoById.get(id)?.evolvesTo ?? []).filter((c) => c <= dexLimit));
  }

  const renderEvoTile = (id: number): ReactNode => {
    const method = evoById.get(id)?.method;
    const label = method ? formatEvolutionMethod(method, lang) : null;
    const isCurrent = id === speciesId;
    const body = (
      <>
        <PokemonSprite pokemonId={id} name={nameOf(id)} size="sm" />
        <span className="max-w-full truncate text-[11px] leading-tight">{nameOf(id)}</span>
        {label && (
          <span className="max-w-full text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
            {label}
          </span>
        )}
      </>
    );
    const shell =
      "flex w-[4.5rem] shrink-0 flex-col items-center rounded-md px-1 py-1 text-center";
    return isCurrent ? (
      <span
        key={id}
        className={`${shell} bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50`}
      >
        {body}
      </span>
    ) : (
      // Clicking another family member reopens the (single) card for it.
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        className={`${shell} text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}
      >
        {body}
      </button>
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
        {/* Name, sprite and types stacked on the centre axis; the dex number
            moved down into the tiles below. Close button is absolute so it
            doesn't pull the name off-centre. */}
        <div className="relative mb-3 flex items-start gap-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={t.dialog.cancel}
            className="absolute right-0 top-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
          {/* Left column: name centred over the sprite, types underneath.
              shrink-0 keeps it at its natural width so the evolution tree
              beside it takes the remaining space. */}
          <div className="flex shrink-0 flex-col items-center text-center">
            <h2 className="text-lg font-semibold">{pokemonName(pokemon, lang)}</h2>
            <PokemonSprite pokemonId={pokemon.id} name={pokemonName(pokemon, lang)} size="xl" />
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {types.map((type) => (
                <TypeBadge key={type} type={type} lang={lang} />
              ))}
            </div>
          </div>
          {/* Right column: the evolution family, centred against the sprite.
              pr-6 keeps it clear of the absolutely positioned close button. */}
          <div className="flex min-w-0 flex-1 self-center flex-col gap-0.5 pr-6">
            {!familyHasEvolution ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{td.noEvolution}</p>
            ) : (
              evoStages.map((ids, stage) => (
                <div key={stage} className="flex flex-wrap justify-center gap-0.5">
                  {ids.map(renderEvoTile)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Headline figures + the jump into the Battle & Catch tab, so the
            block above the stat bars reads at a glance instead of as a run
            of loose label: value lines. */}
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <MetaTile label={td.rank} value={`#${rank}`} />
            <MetaTile label={td.dexNo} value={`#${String(pokemon.id).padStart(3, "0")}`} />
            <MetaTile label={t.pokedex.columns.summe} value={String(pokemon.stats.Summe)} />
            <MetaTile
              label={td.weight}
              value={
                pokemon.weight != null
                  ? `${pokemon.weight.toLocaleString(lang, { maximumFractionDigits: 1 })} kg`
                  : "—"
              }
            />
          </div>
          {formOptions.length > 1 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {td.forms}
              </div>
              <div className="flex flex-wrap gap-1">
                {formOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect(option.id)}
                    aria-pressed={option.id === pokemon.id}
                    className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                      option.id === pokemon.id
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {formLabel(option, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Link
            href={analyzeHref}
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {td.openInAnalyze} <span aria-hidden>→</span>
          </Link>
          {types.length > 0 && (
            <div className="pt-1">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {td.weaknesses}
              </h3>
              <TypeEffectiveness
                defenderTypes={types}
                effectiveness={effectiveness}
                attackTypes={getTypesForGeneration(generation)}
                lang={lang}
              />
            </div>
          )}
        </div>

        {/* Base stats */}
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {td.stats}
        </h3>
        <div className="mb-4 space-y-1">
          {(pokemon.stats.Spezial !== undefined ? STAT_ROWS_GEN1 : STAT_ROWS).map(({ key, labelKey }) => {
            const value = pokemon.stats[key] ?? 0;
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

        {/* Full level-up move list (bottom) */}
        {moveList.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {td.moves}
            </h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {moveList.map((mv, i) => (
                <MoveRow key={`${mv.name}-${i}`} move={mv} lang={lang} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
