"use client";

import type { ReactNode } from "react";
import { Player, RunMode } from "@/generated/prisma/enums";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type { LocalizedNames } from "@/lib/i18n/localize";
import { localizeName } from "@/lib/i18n/localize";
import type { ProgressStats } from "@/lib/progress";
import { TeamWeaknessesView, type TeamMember } from "@/components/TeamWeaknessesView";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { ProgressBar } from "@/components/ProgressBar";
import { BadgeIcon } from "@/components/BadgeIcon";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";

export type OverviewStats = {
  perPlayer: {
    player: Player;
    caught: number;
    bankSumme: number;
    bankSummeMax: number;
    teamSumme: number;
    teamSummeMax: number;
  }[];
  totalDeaths: number;
  teamSumme: number;
  teamSummeMax: number;
  capCurrent: number | null;
  capNext: number | null;
};

export type OverviewDeathTally = { PLAYER1: number; PLAYER2: number; unattributed: number };

export type OverviewBadge = { id: number; badge: LocalizedNames; defeated: boolean };

export type OverviewMemorialEntry = {
  soulLinkId: number;
  routeName: string;
  // name = nickname when set (else species); species carries the species name
  // in parentheses when a nickname is shown.
  pokemon: { id: number; name: string; species: string | null }[];
  deathPlayer: Player | null;
  deathCause: string | null;
};

function StatTile({
  value,
  label,
  size = "lg",
}: {
  value: ReactNode;
  label: string;
  // "sm" for values that carry four numbers (the level cap) - at the default
  // size those overflow the tile on a two-column phone layout.
  size?: "lg" | "sm";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className={`font-bold tabular-nums ${size === "lg" ? "text-2xl" : "text-base"}`}>
        {value}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

// A cap prints as "<boss level> / <team level>", same shape the Journey tab
// uses: one member may match the boss, everyone else sits two below (house
// rule). The TEAM level carries the emphasis - that's the one you can level
// every new catch up to right now, so it's the number being looked for.
function CapValue({ level, emphasize = false }: { level: number | null; emphasize?: boolean }) {
  if (level === null) return <span>–</span>;
  // Same colour and weight throughout - the only thing that stands out is the
  // SIZE of the current cap's team level, the number every new catch can be
  // raised to right now.
  if (!emphasize) {
    return <span className="whitespace-nowrap">{`${level} / ${level - 2}`}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      {level} / <span className="text-2xl">{level - 2}</span>
    </span>
  );
}

export function OverviewView({
  lang,
  mode,
  teams,
  table,
  attackTypes,
  offensiveGaps,
  coverageLevel,
  stats,
  deathTally,
  memorial,
  routeProgress,
  levelCapProgress,
  levelCapMarkerAt,
  badges,
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TeamMember[] }[];
  table: EffectivenessTable;
  attackTypes: string[];
  offensiveGaps: { player: Player; gaps: string[] }[];
  coverageLevel: number;
  stats: OverviewStats;
  deathTally: OverviewDeathTally | null;
  memorial: OverviewMemorialEntry[];
  routeProgress: ProgressStats;
  levelCapProgress: ProgressStats;
  levelCapMarkerAt: number | null;
  badges: OverviewBadge[];
}) {
  const t = translations[lang].overview;
  const tLinks = translations[lang].links;
  const playerLabel = usePlayerLabel();
  const detail = usePokemonDetail();
  const isClassic = mode === RunMode.CLASSIC;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">{t.heading}</h2>

      {/* Progress: the same two bars shown on the Encounter and Journey
          tabs, just bigger. */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.progress}
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t.encounterProgress}
            </div>
            <ProgressBar
              size="md"
              done={routeProgress.done}
              total={routeProgress.total}
              percent={routeProgress.percent}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t.battleProgress}
            </div>
            <ProgressBar
              size="md"
              done={levelCapProgress.done}
              total={levelCapProgress.total}
              percent={levelCapProgress.percent}
              markerAt={levelCapMarkerAt ?? undefined}
              markerTitle={translations[lang].levelcaps.eliteFourMarker}
            />
          </div>
        </div>
      </section>

      {/* Badges */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.badgesHeading}
        </h3>
        {badges.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.badgesEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <BadgeIcon
                key={b.id}
                nameEn={b.badge.en}
                label={localizeName(b.badge, lang)}
                earned={b.defeated}
              />
            ))}
          </div>
        )}
      </section>

      {/* Dashboard */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.dashboard}
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              💀 {deathTally ? t.deathTallyHeading : t.totalDeaths}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">{stats.totalDeaths}</span>
                {deathTally && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">{t.totalDeaths}</span>
                )}
              </span>
              {deathTally &&
                ([Player.PLAYER1, Player.PLAYER2] as const).map((p) => (
                  <span key={p} className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums">{deathTally[p]}</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">{playerLabel(p)}</span>
                  </span>
                ))}
            </div>
            {deathTally && deathTally.unattributed > 0 && (
              <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {t.deathTallyUnattributed(deathTally.unattributed)}
              </div>
            )}
          </div>
          <StatTile value={`${stats.teamSumme} → ${stats.teamSummeMax}`} label={t.teamBst} />
          <StatTile
            size="sm"
            value={
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <CapValue level={stats.capCurrent} emphasize />
                <span>→</span>
                <CapValue level={stats.capNext} />
              </span>
            }
            label={t.levelCap}
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-1 pr-4 font-medium">{t.player}</th>
                <th className="py-1 pr-4 font-medium tabular-nums">{t.caught}</th>
                <th className="py-1 pr-4 font-medium tabular-nums" title={t.bankBstColHint}>
                  {t.bankBstCol}
                </th>
                <th className="py-1 pr-4 font-medium tabular-nums" title={t.teamBstColHint}>
                  {t.teamBstCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.perPlayer.map((row) => (
                <tr key={row.player} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-4 font-medium">
                    {isClassic ? t.team : playerLabel(row.player)}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">{row.caught}</td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {row.bankSumme}
                    <span className="text-zinc-400 dark:text-zinc-500"> → {row.bankSummeMax}</span>
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {row.teamSumme}
                    <span className="text-zinc-400 dark:text-zinc-500"> → {row.teamSummeMax}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Team coverage: defensive (reused) + offensive gaps */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.coverage}
        </h3>
        <div className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <TeamWeaknessesView lang={lang} mode={mode} teams={teams} table={table} attackTypes={attackTypes} />
        </div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {offensiveGaps.map(
            (o) =>
              teams.find((tm) => tm.player === o.player && tm.members.length > 0) && (
                <section
                  key={o.player}
                  className="min-w-[260px] flex-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                    {t.offensiveGaps}
                    {!isClassic && (
                      <span className="font-normal text-zinc-400 dark:text-zinc-500">
                        · {playerLabel(o.player)}
                      </span>
                    )}
                    <span
                      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-300 text-[10px] font-serif italic text-zinc-400 dark:border-zinc-600 dark:text-zinc-500"
                      title={t.offensiveGapsInfo(coverageLevel)}
                    >
                      i
                    </span>
                  </h4>
                  {o.gaps.length === 0 ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.noGaps}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {o.gaps.map((ty) => (
                        <span key={ty} className="inline-flex items-center gap-1">
                          <TypeBadge type={ty} lang={lang} />
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{t.offensiveHint}</p>
                </section>
              ),
          )}
        </div>
      </section>

      {/* Memorial / graveyard */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          💀 {t.memorial}
        </h3>
        {memorial.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.memorialEmpty}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {memorial.map((m) => (
              <li
                key={m.soulLinkId}
                className="rounded-lg border border-red-200 bg-red-50/40 p-3 opacity-90 dark:border-red-900/50 dark:bg-red-950/20"
              >
                <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {m.routeName}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.pokemon.map((p, i) => {
                    // Sprite + name together open the Pokédex card, same as
                    // the sprite does on the Team/Encounter tabs.
                    const body = (
                      <>
                        <PokemonSprite pokemonId={p.id} name={p.species ?? p.name} size="sm" />
                        <span className="text-sm">
                          {p.name}
                          {p.species && (
                            <span className="text-zinc-400 dark:text-zinc-500"> ({p.species})</span>
                          )}
                        </span>
                      </>
                    );
                    return detail ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => detail.open(p.id)}
                        title={p.species ?? p.name}
                        className="flex cursor-pointer items-center gap-1 rounded transition-opacity hover:opacity-70"
                      >
                        {body}
                      </button>
                    ) : (
                      <span key={i} className="flex items-center gap-1">
                        {body}
                      </span>
                    );
                  })}
                </div>
                {(m.deathPlayer || m.deathCause) && (
                  <div className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {m.deathPlayer && tLinks.deadBy(playerLabel(m.deathPlayer))}
                    {m.deathPlayer && m.deathCause ? " · " : ""}
                    {m.deathCause}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
