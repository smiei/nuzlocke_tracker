"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Learnset } from "@/lib/learnset";
import type { Player, RunMode } from "@/generated/prisma/client";
import type { RunSettings } from "@/lib/runSettings";
import { usePersistentState } from "@/lib/usePersistentState";
import { baseSpeciesId } from "@/lib/forms";
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
import { useBlindflug } from "@/components/BlindflugProvider";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Page";
import type { TeamMember } from "@/components/TeamWeaknessesView";

type SubView = "wild" | "trainer";

// One combined card: a Pokémon picked once at the top, a Wild/Trainer toggle,
// and either the catch calculator (Wild) or the battle scout (Trainer) below.
// Wild and Trainer keep their own level (a caught wild's vs a scouted trainer's
// are different numbers), but share the Pokémon selection.
type AnalyzeCardState = {
  id: number;
  selectedId: number | null;
  // Infinite Fusion only: the optional body of the Pokémon picked above, so
  // the card analyses the fusion. Optional so card sets stored before it
  // existed load unchanged.
  bodyId?: number | null;
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
  fusionEnabled,
  state,
  onChange,
  onRemove,
}: {
  catchShared: CatchSharedProps;
  battleShared: BattleSharedProps;
  fusionEnabled: boolean;
  state: AnalyzeCardState;
  onChange: (patch: Partial<AnalyzeCardState>) => void;
  onRemove?: () => void;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const tCatch = translations[lang].catchrate;
  const blindflug = useBlindflug();
  const { selectedId, view, battleLevel } = state;
  // A body stored on a card is ignored in a game without fusions.
  const bodyId = fusionEnabled ? (state.bodyId ?? null) : null;

  const selected = catchShared.pokemonList.find((p) => p.id === selectedId) ?? null;
  const body =
    bodyId !== null ? (catchShared.pokemonList.find((p) => p.id === bodyId) ?? null) : null;
  const components = [selected, body].filter((p): p is Pokemon => p !== null);
  const isLocked = components.some((p) => catchShared.lockedFamilies.has(p.family_id));
  // Shown regardless of Wild/Trainer sub-view, since it matters for a wild
  // catch too (it can blow up before you land the ball). A fusion can use
  // either component's moves.
  const explosive =
    components
      .map((p) => battleShared.explosiveMap[baseSpeciesId(p)])
      .find((boom) => boom !== undefined) ?? null;

  return (
    <Card className="relative">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="×"
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-hover hover:text-ink"
        >
          ✕
        </button>
      )}

      {/* Shared Pokémon picker */}
      <div className="mb-3 flex items-center gap-2 pr-12">
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
      {/* Infinite Fusion: opposing trainers field fusions, and a wild fusion
          catches differently - the picker above is then the head. */}
      {fusionEnabled && (
        <div className="mb-3 flex items-end gap-2 pr-12">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{t.bodyPickerLabel}</span>
            <PokemonCombobox
              lang={lang}
              pokemonList={catchShared.pokemonList}
              selectedId={bodyId}
              onSelect={(id) => onChange({ bodyId: id })}
              onClear={() => onChange({ bodyId: null })}
              lockedFamilyIds={catchShared.lockedFamilies}
            />
          </div>
          <PokemonInfoButton pokemonId={bodyId} label={body ? pokemonName(body, lang) : ""} />
        </div>
      )}
      {isLocked && (
        <p className="mb-3 text-xs text-warning">⚠ {tCatch.lockWarning}</p>
      )}
      {/* Knowing the opponent can blow up in your face is move knowledge. */}
      {explosive && !blindflug && (
        <p
          className={`mb-3 rounded-md px-2.5 py-1.5 text-sm font-medium ${
            explosive.level <= battleLevel
              ? "border border-danger-line bg-danger-bg text-danger"
              : "border border-warning-line bg-warning-bg text-warning"
          }`}
        >
          {t.explosionWarn(explosive.name, explosive.level)}
        </p>
      )}

      {/* Wild / Trainer toggle */}
      <div className="mb-4 inline-flex rounded-md border border-line p-0.5">
        {(["trainer", "wild"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ view: v })}
            aria-pressed={view === v}
            className={`h-10 rounded-md px-4 text-sm font-medium transition-colors ${
              view === v
                ? "bg-accent text-accent-ink"
                : "text-ink-muted hover:bg-hover hover:text-ink"
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
          bodyId={bodyId}
          state={state.wild}
          onChange={(patch) => onChange({ wild: { ...state.wild, ...patch } })}
        />
      ) : (
        <BattleCardBody
          shared={battleShared}
          selectedId={selectedId}
          bodyId={bodyId}
          level={state.battleLevel}
          onChange={(patch) => onChange({ battleLevel: patch.level })}
        />
      )}
    </Card>
  );
}

// The combined "Kampf & Fang" tab: several cards, each analysing one Pokémon as
// a wild catch or a trainer battle. Card set persists per client (never synced).
export function AnalyzeView({
  runId,
  mode,
  players,
  pokemonList,
  generation,
  versionGroup,
  effectiveness,
  attackTypes,
  catchRates,
  lockedFamilyIds,
  openSlots,
  learnset,
  teams,
  explosiveMap,
  settings,
  fusionEnabled = false,
}: {
  runId: number;
  mode: RunMode;
  // The run's players in order (src/lib/players.ts).
  players: Player[];
  pokemonList: Pokemon[];
  generation: number;
  versionGroup: string;
  effectiveness: EffectivenessTable;
  attackTypes: string[];
  catchRates: Record<number, number>;
  lockedFamilyIds: number[];
  openSlots: OpenSlot[];
  learnset: Learnset;
  teams: { player: Player; members: TeamMember[] }[];
  explosiveMap: Record<number, { name: string; level: number }>;
  settings: RunSettings;
  // The run's game pack has fusions (Infinite Fusion): offers a body picker.
  fusionEnabled?: boolean;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const lockedFamilies = useMemo(() => new Set(lockedFamilyIds), [lockedFamilyIds]);

  const catchShared: CatchSharedProps = {
    runId,
    mode,
    players,
    pokemonList,
    catchRates,
    lockedFamilies,
    generation,
    versionGroup,
    openSlots,
    effectiveness,
    attackTypes,
    settings,
  };
  const battleShared: BattleSharedProps = {
    pokemonList,
    table: effectiveness,
    attackTypes,
    learnset,
    teams,
    mode,
    explosiveMap,
  };

  const [cards, setCards] = usePersistentState<AnalyzeCardState[]>("nuzlocke:analyze:cards", [
    newAnalyzeCard(0),
  ]);

  // Arriving from a Pokédex info card's "Im Kampf & Fang öffnen" link:
  // ?pokemon=<id> (plus &body=<id> from a fusion's card) drops that selection
  // into the first card (resetting the catch inputs exactly like picking it by
  // hand would) and is then stripped from the URL, so a later manual change
  // isn't undone by a refresh.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pokemonParam = searchParams.get("pokemon");
  const bodyParam = searchParams.get("body");

  useEffect(() => {
    if (!pokemonParam) return;
    const id = Number(pokemonParam);
    const bodyNumber = Number(bodyParam);
    const bodyId = Number.isFinite(bodyNumber) && bodyNumber > 0 ? bodyNumber : null;
    if (Number.isFinite(id) && id > 0) {
      setCards((cs) => {
        const [first, ...rest] = cs.length > 0 ? cs : [newAnalyzeCard(0)];
        if (first.selectedId === id && (first.bodyId ?? null) === bodyId) return cs;
        return [
          {
            ...first,
            selectedId: id,
            bodyId,
            wild: { ...first.wild, ball: "poke", status: "none", hpPercent: 100 },
          },
          ...rest,
        ];
      });
    }
    const run = searchParams.get("run");
    router.replace(run ? `${pathname}?run=${run}` : pathname, { scroll: false });
  }, [pokemonParam, bodyParam, pathname, router, searchParams, setCards]);

  return (
    <div>
      <PageHeader title={t.analyzeHeading} />
      <div className="flex flex-col gap-6">
        {cards.map((card) => (
          <AnalyzeCard
            key={card.id}
            catchShared={catchShared}
            battleShared={battleShared}
            fusionEnabled={fusionEnabled}
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
        className="mt-6 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <span className="text-lg leading-none">+</span> {t.addCard}
      </button>
    </div>
  );
}
