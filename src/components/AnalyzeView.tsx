"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Learnset } from "@/lib/learnset";
import type { Player, RunMode } from "@/generated/prisma/client";
import type { RunSettings } from "@/lib/runSettings";
import { usePersistentState } from "@/lib/usePersistentState";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { PokemonInfoButton } from "@/components/PokemonDetailProvider";
import {
  CatchCardBody,
  newCatchBody,
  type CatchBodyState,
  type CatchSharedProps,
  type OpenSlot,
} from "@/components/CatchRateView";
import { BattleCardBody, type BattleSharedProps } from "@/components/BattleView";
import type { TeamMember } from "@/components/TeamWeaknessesView";

type SubView = "wild" | "trainer";

// One combined card: a Pokémon picked once at the top, a Wild/Trainer toggle,
// and either the catch calculator (Wild) or the battle scout (Trainer) below.
// Wild and Trainer keep their own level (a caught wild's vs a scouted trainer's
// are different numbers), but share the Pokémon selection.
type AnalyzeCardState = {
  id: number;
  selectedId: number | null;
  view: SubView;
  wild: CatchBodyState;
  battleLevel: number;
};

function newAnalyzeCard(id: number): AnalyzeCardState {
  return { id, selectedId: null, view: "trainer", wild: newCatchBody(), battleLevel: 100 };
}

function AnalyzeCard({
  catchShared,
  battleShared,
  state,
  onChange,
  onRemove,
}: {
  catchShared: CatchSharedProps;
  battleShared: BattleSharedProps;
  state: AnalyzeCardState;
  onChange: (patch: Partial<AnalyzeCardState>) => void;
  onRemove?: () => void;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const tCatch = translations[lang].catchrate;
  const { selectedId, view, battleLevel } = state;

  const selected = catchShared.pokemonList.find((p) => p.id === selectedId) ?? null;
  const isLocked = selected ? catchShared.lockedFamilies.has(selected.family_id) : false;
  // Shown regardless of Wild/Trainer sub-view, since it matters for a wild
  // catch too (it can blow up before you land the ball).
  const explosive = selected ? battleShared.explosiveMap[selected.id] ?? null : null;

  return (
    <div className="relative rounded-xl border border-zinc-300 p-4 dark:border-zinc-700 sm:p-5">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="×"
          className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      )}

      {/* Shared Pokémon picker */}
      <div className="mb-3 flex items-center gap-2 pr-6">
        <div className="min-w-0 flex-1">
          <PokemonCombobox
            lang={lang}
            pokemonList={catchShared.pokemonList}
            selectedId={selectedId}
            onSelect={(id) =>
              onChange(
                id === selectedId
                  ? { selectedId: id }
                  : { selectedId: id, wild: { ...state.wild, ball: "poke", status: "none", hpPercent: 100 } },
              )
            }
            onClear={() =>
              onChange({
                selectedId: null,
                wild: { ...state.wild, ball: "poke", status: "none", hpPercent: 100 },
              })
            }
            lockedFamilyIds={catchShared.lockedFamilies}
          />
        </div>
        <PokemonInfoButton pokemonId={selectedId} label={selected ? pokemonName(selected, lang) : ""} />
      </div>
      {isLocked && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">⚠ {tCatch.lockWarning}</p>
      )}
      {explosive && (
        <p
          className={`mb-3 rounded-md px-2.5 py-1.5 text-sm font-medium ${
            explosive.level <= battleLevel
              ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          {t.explosionWarn(explosive.name, explosive.level)}
        </p>
      )}

      {/* Wild / Trainer toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
        {(["trainer", "wild"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ view: v })}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {v === "wild" ? t.viewWild : t.viewTrainer}
          </button>
        ))}
      </div>

      {view === "wild" ? (
        <CatchCardBody
          shared={catchShared}
          selectedId={selectedId}
          state={state.wild}
          onChange={(patch) => onChange({ wild: { ...state.wild, ...patch } })}
        />
      ) : (
        <BattleCardBody
          shared={battleShared}
          selectedId={selectedId}
          level={state.battleLevel}
          onChange={(patch) => onChange({ battleLevel: patch.level })}
        />
      )}
    </div>
  );
}

// The combined "Kampf & Fang" tab: several cards, each analysing one Pokémon as
// a wild catch or a trainer battle. Card set persists per client (never synced).
export function AnalyzeView({
  runId,
  mode,
  pokemonList,
  generation,
  effectiveness,
  attackTypes,
  catchRates,
  lockedFamilyIds,
  openSlots,
  learnset,
  teams,
  explosiveMap,
  settings,
}: {
  runId: number;
  mode: RunMode;
  pokemonList: Pokemon[];
  generation: number;
  effectiveness: EffectivenessTable;
  attackTypes: string[];
  catchRates: Record<number, number>;
  lockedFamilyIds: number[];
  openSlots: OpenSlot[];
  learnset: Learnset;
  teams: { player: Player; members: TeamMember[] }[];
  explosiveMap: Record<number, { name: string; level: number }>;
  settings: RunSettings;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const lockedFamilies = useMemo(() => new Set(lockedFamilyIds), [lockedFamilyIds]);

  const catchShared: CatchSharedProps = {
    runId,
    mode,
    pokemonList,
    catchRates,
    lockedFamilies,
    generation,
    openSlots,
    effectiveness,
    attackTypes,
    settings,
  };
  const battleShared: BattleSharedProps = {
    pokemonList,
    table: effectiveness,
    attackTypes,
    generation,
    learnset,
    teams,
    mode,
    explosiveMap,
  };

  const [cards, setCards] = usePersistentState<AnalyzeCardState[]>("nuzlocke:analyze:cards", [
    newAnalyzeCard(0),
  ]);

  // Arriving from a Pokédex info card's "Im Kampf & Fang öffnen" link:
  // ?pokemon=<id> drops that species into the first card (resetting the catch
  // inputs exactly like picking it by hand would) and is then stripped from
  // the URL, so a later manual change isn't undone by a refresh.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pokemonParam = searchParams.get("pokemon");

  useEffect(() => {
    if (!pokemonParam) return;
    const id = Number(pokemonParam);
    if (Number.isFinite(id) && id > 0) {
      setCards((cs) => {
        const [first, ...rest] = cs.length > 0 ? cs : [newAnalyzeCard(0)];
        if (first.selectedId === id) return cs;
        return [
          {
            ...first,
            selectedId: id,
            wild: { ...first.wild, ball: "poke", status: "none", hpPercent: 100 },
          },
          ...rest,
        ];
      });
    }
    const run = searchParams.get("run");
    router.replace(run ? `${pathname}?run=${run}` : pathname, { scroll: false });
  }, [pokemonParam, pathname, router, searchParams, setCards]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.analyzeHeading}</h2>
      <div className="flex flex-col gap-5">
        {cards.map((card) => (
          <AnalyzeCard
            key={card.id}
            catchShared={catchShared}
            battleShared={battleShared}
            state={card}
            onChange={(patch) =>
              setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
            }
            onRemove={
              cards.length > 1
                ? () => setCards((cs) => cs.filter((c) => c.id !== card.id))
                : undefined
            }
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setCards((cs) => [...cs, newAnalyzeCard(Math.max(-1, ...cs.map((c) => c.id)) + 1)])
        }
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
      >
        <span className="text-lg leading-none">+</span> {t.addCard}
      </button>
    </div>
  );
}
