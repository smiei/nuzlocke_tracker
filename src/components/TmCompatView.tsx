"use client";

import { useMemo, useState } from "react";
import { Player, RunMode } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type { Moveset, TmCompatTable, TmLearnMethod } from "@/lib/learnset";
import { tmLearnMethods } from "@/lib/learnset";
import { MoveCombobox, type MoveOption } from "@/components/MoveCombobox";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";

export type TmTeamMember = { pokemonId: number; name: string };

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
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TmTeamMember[] }[];
  moves: MoveOption[];
  tmCompat: TmCompatTable;
  moveset: Moveset;
}) {
  const t = translations[lang].tms;
  const playerLabel = usePlayerLabel();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const isClassic = mode === RunMode.CLASSIC;

  const entry = selectedSlug ? tmCompat[selectedSlug] : undefined;
  const isMachineOrTutor = !!entry && (!!entry.machine || !!entry.tutor);

  // For each member: how they can learn the move (TM/HM/tutor) + level-up fallback.
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
          .sort((a, b) => a.rank - b.rank),
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
                      <span>{isClassic ? t.teamHeading : playerLabel(team.player)}</span>
                      <span className="text-xs font-normal tabular-nums text-zinc-400 dark:text-zinc-500">
                        {rowsFor(team.members).filter((r) => r.methods.length > 0).length}/
                        {team.members.length}
                      </span>
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {rowsFor(team.members).map((r) => (
                        <li
                          key={r.pokemonId + "-" + r.name}
                          className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                            r.methods.length === 0 ? "opacity-60" : ""
                          }`}
                        >
                          <PokemonSprite pokemonId={r.pokemonId} name={r.name} size="sm" />
                          <span className="flex-1 text-sm">{r.name}</span>
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
