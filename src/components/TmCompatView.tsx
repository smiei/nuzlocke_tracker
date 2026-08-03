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

// onTeam = sits in one of the 6 team slots; everything else is the bank
// (caught and alive, but boxed).
export type TmTeamMember = { pokemonId: number; name: string; onTeam: boolean };

const METHOD_BADGE: Record<TmLearnMethod | "level", string> = {
  tm: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  hm: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  tutor: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  level: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
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
            const methods = selectedSlug ? tmLearnMethods(entry, m.pokemonId) : [];
            const byLevel = selectedSlug
              ? (moveset[String(m.pokemonId)] ?? []).some(([, s]) => s === selectedSlug)
              : false;
            return { ...m, methods, byLevel, rank: methods.length > 0 ? 0 : byLevel ? 1 : 2 };
          })
          .sort((a, b) => Number(b.onTeam) - Number(a.onTeam) || a.rank - b.rank),
    [selectedSlug, entry, moveset],
  );

  const hasAnyMember = teams.some((tm) => tm.members.length > 0);

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">{t.heading}</h2>
      <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">{t.caveat}</p>

      <div className="mb-4 max-w-sm">
        <MoveCombobox
          lang={lang}
          moves={moves}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
      </div>

      {selectedDetail && (
        <div className="mb-4 max-w-lg">
          <MoveDetailPanel move={selectedDetail} lang={lang} />
        </div>
      )}

      {!hasAnyMember ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.empty}</p>
      ) : selectedSlug === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.hint}</p>
      ) : (
        <div className="space-y-4">
          {!isMachineOrTutor && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t.notLearnable}
            </p>
          )}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            {teams.map(
              (team) =>
                team.members.length > 0 && (
                  <section
                    key={team.player}
                    className="min-w-[260px] flex-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <h3 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      {/* Solo runs have a single section, and the Team/Bank
                          dividers below already name the groups - only
                          SoulLink needs a heading here, to tell the two
                          players' sections apart. */}
                      <span>{isClassic ? "" : playerLabel(team.player)}</span>
                      <span className="text-xs font-normal tabular-nums text-zinc-400 dark:text-zinc-500">
                        {rowsFor(team.members).filter((r) => r.methods.length > 0).length}/
                        {team.members.length}
                      </span>
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {rowsFor(team.members).map((r, i, rows) => (
                        <Fragment key={r.pokemonId + "-" + r.name}>
                          {/* One labelled divider in front of each group, so
                              the 6-slot team and the boxed rest read as two
                              blocks with matching headings. */}
                          {(i === 0 || rows[i - 1].onTeam !== r.onTeam) && (
                            <li
                              aria-hidden
                              className={`flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${
                                i === 0 ? "" : "mt-1 pt-1"
                              }`}
                            >
                              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                              {r.onTeam ? t.teamHeading : t.bankHeading}
                              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                            </li>
                          )}
                          <li
                            className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                              r.methods.length === 0 ? "opacity-60" : ""
                            } ${
                              r.onTeam
                                ? "bg-zinc-100 font-medium dark:bg-zinc-800/70"
                                : ""
                            }`}
                          >
                            {detail ? (
                              <button
                                type="button"
                                onClick={() => detail.open(r.pokemonId)}
                                title={r.name}
                                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left transition-opacity hover:opacity-70"
                              >
                                <PokemonSprite pokemonId={r.pokemonId} name={r.name} size="sm" />
                                <span className="truncate text-sm">{r.name}</span>
                              </button>
                            ) : (
                              <>
                                <PokemonSprite pokemonId={r.pokemonId} name={r.name} size="sm" />
                                <span className="flex-1 text-sm">{r.name}</span>
                              </>
                            )}
                            {r.methods.length > 0 ? (
                              r.methods.map((mth) => (
                                <span
                                  key={mth}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${METHOD_BADGE[mth]}`}
                                >
                                  {t.method[mth]}
                                </span>
                              ))
                            ) : r.byLevel ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${METHOD_BADGE.level}`}
                              >
                                {t.method.level}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-300 dark:text-zinc-600">–</span>
                            )}
                            </li>
                        </Fragment>
                      ))}
                    </ul>
                  </section>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
