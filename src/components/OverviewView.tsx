"use client";

import { Player, RunMode } from "@/generated/prisma/enums";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { TeamWeaknessesView, type TeamMember } from "@/components/TeamWeaknessesView";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";

export type OverviewStats = {
  perPlayer: { player: Player; caught: number; deaths: number; caused: number }[];
  totalDeaths: number;
  teamSumme: number;
  teamSummeMax: number;
  capCurrent: number | null;
  capNext: number | null;
};

export type OverviewMemorialEntry = {
  soulLinkId: number;
  routeName: string;
  pokemon: { id: number; name: string }[];
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

export function OverviewView({
  lang,
  mode,
  teams,
  table,
  attackTypes,
  offensiveGaps,
  stats,
  memorial,
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TeamMember[] }[];
  table: EffectivenessTable;
  attackTypes: string[];
  offensiveGaps: { player: Player; gaps: string[] }[];
  stats: OverviewStats;
  memorial: OverviewMemorialEntry[];
}) {
  const t = translations[lang].overview;
  const tLinks = translations[lang].links;
  const playerLabel = usePlayerLabel();
  const isClassic = mode === RunMode.CLASSIC;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">{t.heading}</h2>

      {/* Dashboard */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t.dashboard}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile value={stats.totalDeaths} label={t.totalDeaths} />
          <StatTile value={`${stats.teamSumme} → ${stats.teamSummeMax}`} label={t.teamBst} />
          <StatTile value={stats.capCurrent ?? "–"} label={t.capCurrent} />
          <StatTile value={stats.capNext ?? "–"} label={t.capNext} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-1 pr-4 font-medium">{t.player}</th>
                <th className="py-1 pr-4 font-medium tabular-nums">{t.caught}</th>
                <th className="py-1 pr-4 font-medium tabular-nums">{t.deaths}</th>
                <th className="py-1 pr-4 font-medium tabular-nums">{t.caused}</th>
              </tr>
            </thead>
            <tbody>
              {stats.perPlayer.map((row) => (
                <tr key={row.player} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-4 font-medium">
                    {isClassic ? t.team : playerLabel(row.player)}
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">{row.caught}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{row.deaths}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{row.caused}</td>
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
                  <h4 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                    {t.offensiveGaps}
                    {!isClassic && (
                      <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
                        · {playerLabel(o.player)}
                      </span>
                    )}
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
                <div className="flex items-center gap-2">
                  {m.pokemon.map((p) => (
                    <span key={p.id} className="flex items-center gap-1">
                      <PokemonSprite pokemonId={p.id} name={p.name} size="sm" />
                      <span className="text-sm">{p.name}</span>
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
