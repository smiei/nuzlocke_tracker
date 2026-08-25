"use client";

import { Fragment, useMemo, useState } from "react";
import { Player, RunMode } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type {
  Moveset,
  MovesTable,
  MoveTypeHistoryEntry,
  TmCompatTable,
  TmLearnMethod,
} from "@/lib/learnset";
import { moveDetail, tmLearnMethods } from "@/lib/learnset";
import { MoveCombobox, type MoveOption } from "@/components/MoveCombobox";
import { MoveDetailPanel } from "@/components/MoveDetailPanel";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, PageHeader } from "@/components/ui/Page";

// onTeam = sits in one of the 6 team slots; everything else is the bank
// (caught and alive, but boxed).
export type TmTeamMember = {
  // What to show (may be an alternate forme).
  pokemonId: number;
  // What to look learnability up under: TM/tutor compat and level-up movesets
  // are keyed by species, and a forme inherits its species' movepool.
  speciesId: number;
  name: string;
  onTeam: boolean;
};

// TM/HM/tutor all answer the question you came here with - "can it learn this?"
// - so they share one positive tone and the label tells them apart; a
// level-up-only match is the weaker answer and stays neutral. Each of the four
// used to carry its own hand-picked colour pair (emerald/sky/violet/zinc).
const METHOD_TONE: Record<TmLearnMethod | "level", "success" | "neutral"> = {
  tm: "success",
  hm: "success",
  tutor: "success",
  level: "neutral",
};

export function TmCompatView({
  lang,
  mode,
  teams,
  moves,
  tmCompat,
  moveset,
  movesTable,
  generation,
  moveTypeHistory,
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TmTeamMember[] }[];
  moves: MoveOption[];
  tmCompat: TmCompatTable;
  moveset: Moveset;
  movesTable: MovesTable;
  generation: number;
  moveTypeHistory: MoveTypeHistoryEntry[];
}) {
  const t = translations[lang].tms;
  const playerLabel = usePlayerLabel();
  const detail = usePokemonDetail();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const isClassic = mode === RunMode.CLASSIC;

  const entry = selectedSlug ? tmCompat[selectedSlug] : undefined;
  const isMachineOrTutor = !!entry && (!!entry.machine || !!entry.tutor);

  // Stats/category/effect of the looked-up move, resolved to this game's
  // generation - the same panel the Pokédex card shows per level-up move.
  const selectedDetail = useMemo(
    () =>
      selectedSlug
        ? moveDetail(movesTable, selectedSlug, lang, generation, moveTypeHistory)
        : null,
    [selectedSlug, movesTable, lang, generation, moveTypeHistory],
  );

  // For each member: how they can learn the move (TM/HM/tutor) + level-up
  // fallback. The active team always sorts above the bank - that's the part
  // you actually plan around - and learnability orders within each block.
  const rowsFor = useMemo(
    () =>
      (members: TmTeamMember[]) =>
        members
          .map((m) => {
            const methods = selectedSlug ? tmLearnMethods(entry, m.speciesId) : [];
            const byLevel = selectedSlug
              ? (moveset[String(m.speciesId)] ?? []).some(([, s]) => s === selectedSlug)
              : false;
            return { ...m, methods, byLevel, rank: methods.length > 0 ? 0 : byLevel ? 1 : 2 };
          })
          .sort((a, b) => Number(b.onTeam) - Number(a.onTeam) || a.rank - b.rank),
    [selectedSlug, entry, moveset],
  );

  const hasAnyMember = teams.some((tm) => tm.members.length > 0);

  return (
    <div>
      <PageHeader title={t.heading} description={t.caveat} />

      <div className="mb-6 max-w-sm">
        <MoveCombobox
          lang={lang}
          moves={moves}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
      </div>

      {selectedDetail && (
        <div className="mb-6 max-w-lg">
          <MoveDetailPanel move={selectedDetail} lang={lang} />
        </div>
      )}

      {!hasAnyMember ? (
        <EmptyState title={t.empty} />
      ) : selectedSlug === null ? (
        <EmptyState title={t.hint} />
      ) : (
        <div className="space-y-6">
          {!isMachineOrTutor && (
            <p className="rounded-md border border-warning-line bg-warning-bg px-3 py-2 text-sm text-warning">
              {t.notLearnable}
            </p>
          )}
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            {teams.map((team) => {
              if (team.members.length === 0) return null;
              // Was recomputed three times per team (twice inline in the JSX).
              const rows = rowsFor(team.members);
              const canLearn = rows.filter((r) => r.methods.length > 0).length;
              return (
                <Card key={team.player} className="min-w-[260px] flex-1">
                  <div className="mb-3 flex items-baseline gap-2">
                    {/* Solo runs have a single section, and the Team/Bank
                        dividers below already name the groups - only SoulLink
                        needs a heading here, to tell the two players' sections
                        apart. It used to render an empty <span> in Classic. */}
                    {!isClassic && (
                      <h2 className="text-sm font-semibold text-ink">
                        {playerLabel(team.player)}
                      </h2>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-ink-subtle">
                      {canLearn}/{team.members.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {rows.map((r, i) => (
                      <Fragment key={r.pokemonId + "-" + r.name}>
                        {/* One labelled divider in front of each group, so the
                            6-slot team and the boxed rest read as two blocks
                            with matching headings. */}
                        {(i === 0 || rows[i - 1].onTeam !== r.onTeam) && (
                          <li
                            aria-hidden
                            className={`flex items-center gap-2 text-xs uppercase tracking-wide text-ink-subtle ${
                              i === 0 ? "" : "mt-2"
                            }`}
                          >
                            <span className="h-px flex-1 bg-line" />
                            {r.onTeam ? t.teamHeading : t.bankHeading}
                            <span className="h-px flex-1 bg-line" />
                          </li>
                        )}
                        <li
                          className={`flex items-center gap-2 rounded-md px-2 ${
                            r.methods.length === 0 ? "opacity-60" : ""
                          } ${r.onTeam ? "bg-sunken font-medium" : ""}`}
                        >
                          {detail ? (
                            <button
                              type="button"
                              onClick={() => detail.open(r.pokemonId)}
                              title={r.name}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-2 text-left transition-opacity hover:opacity-70"
                            >
                              <PokemonSprite pokemonId={r.pokemonId} name={r.name} size="sm" />
                              <span className="truncate text-sm">{r.name}</span>
                            </button>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-2 py-2">
                              <PokemonSprite pokemonId={r.pokemonId} name={r.name} size="sm" />
                              <span className="truncate text-sm">{r.name}</span>
                            </div>
                          )}
                          {r.methods.length > 0 ? (
                            r.methods.map((mth) => (
                              <Badge key={mth} tone={METHOD_TONE[mth]} className="shrink-0">
                                {t.method[mth]}
                              </Badge>
                            ))
                          ) : r.byLevel ? (
                            <Badge tone={METHOD_TONE.level} className="shrink-0">
                              {t.method.level}
                            </Badge>
                          ) : (
                            <span className="shrink-0 text-xs text-ink-subtle">&ndash;</span>
                          )}
                        </li>
                      </Fragment>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
