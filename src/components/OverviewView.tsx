"use client";

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

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

// House rule: one team member may reach the boss's own level, the rest stay
// two levels below - the same "-2" convention as the Journey tab's target
// level, applied here to both the current and the next cap.
function safeTarget(level: number | null): string {
  return level === null ? "–" : String(level - 2);
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
  badges: OverviewBadge[];
}) {
  const t = translations[lang].overview;
  const tLinks = translations[lang].links;
  const playerLabel = usePlayerLabel();
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
            />
          </div>
        </div>
      </section>

      {/* Dashboard */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.dashboard}
        </h3>

        <div className={`grid grid-cols-2 gap-3 ${deathTally ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {deathTally && (
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                💀 {t.deathTallyHeading}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                {([Player.PLAYER1, Player.PLAYER2] as const).map((p) => (
                  <span key={p} className="flex items-baseline gap-1">
                    <span className="text-xl font-bold tabular-nums">{deathTally[p]}</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">{playerLabel(p)}</span>
                  </span>
                ))}
              </div>
              {deathTally.unattributed > 0 && (
                <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {t.deathTallyUnattributed(deathTally.unattributed)}
                </div>
              )}
            </div>
          )}
          <StatTile value={stats.totalDeaths} label={t.totalDeaths} />
          <StatTile value={`${stats.teamSumme} → ${stats.teamSummeMax}`} label={t.teamBst} />
          <StatTile
            value={`${safeTarget(stats.capCurrent)} → ${safeTarget(stats.capNext)}`}
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
                  {m.pokemon.map((p, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <PokemonSprite pokemonId={p.id} name={p.species ?? p.name} size="sm" />
                      <span className="text-sm">
                        {p.name}
                        {p.species && (
                          <span className="text-zinc-400 dark:text-zinc-500"> ({p.species})</span>
                        )}
                      </span>
                    </span>
                  ))}
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
