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
import { DeathPointPicker, type DeathPointOption } from "@/components/DeathPointPicker";
import { Card } from "@/components/ui/Card";
import { EmptyState, PageHeader, Section } from "@/components/ui/Page";

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
  // Journey milestone the run had reached when this died, plus its label.
  deathLevelCapId: number | null;
  deathPointLabel: string | null;
  // false = predates death-point tracking; those sort first and invite an edit.
  recorded: boolean;
  sortIndex: number;
  diedAt: number | null;
};

// One number, its label, and (SoulLink only) the same number split per player.
//
// That split used to live in a separate four-column table below the tiles,
// which repeated the tiles' own figures - team BST was stated twice, and in a
// solo run the whole table was a single row saying what the tiles already said.
// Folding it in leaves one shape for every statistic.
function StatTile({
  value,
  label,
  labelHint,
  parts,
  footnote,
  size = "lg",
}: {
  value: ReactNode;
  label: string;
  labelHint?: string;
  parts?: { label: string; value: ReactNode }[];
  footnote?: string;
  // "sm" for values that carry four numbers (the level cap) - at the default
  // size those overflow the tile on a two-column phone layout.
  size?: "lg" | "sm";
}) {
  return (
    <Card padding="sm">
      <div
        className={`font-bold tabular-nums text-ink ${size === "lg" ? "text-2xl" : "text-base"}`}
      >
        {value}
      </div>
      <div className="text-xs text-ink-muted" title={labelHint}>
        {label}
      </div>
      {parts && parts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-2">
          {parts.map((part) => (
            <span key={part.label} className="text-xs text-ink-muted">
              <span className="font-semibold tabular-nums text-ink">{part.value}</span> {part.label}
            </span>
          ))}
        </div>
      )}
      {footnote && <div className="mt-1 text-xs text-ink-subtle">{footnote}</div>}
    </Card>
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
  runId,
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
  deathPointOptions,
}: {
  runId: number;
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
  deathPointOptions: DeathPointOption[];
}) {
  const t = translations[lang].overview;
  const tLinks = translations[lang].links;
  const playerLabel = usePlayerLabel();
  const detail = usePokemonDetail();
  const isClassic = mode === RunMode.CLASSIC;

  const sum = (pick: (row: OverviewStats["perPlayer"][number]) => number) =>
    stats.perPlayer.reduce((acc, row) => acc + pick(row), 0);
  const totalCaught = sum((r) => r.caught);
  const bankSumme = sum((r) => r.bankSumme);
  const bankSummeMax = sum((r) => r.bankSummeMax);

  // Per-player splits only mean something in SoulLink; a solo run's "split" is
  // the total again.
  const splitBy = (pick: (row: OverviewStats["perPlayer"][number]) => ReactNode) =>
    isClassic
      ? undefined
      : stats.perPlayer.map((row) => ({ label: playerLabel(row.player), value: pick(row) }));

  // Nothing caught and nobody lost: the dashboard would be a wall of zeros and
  // the coverage sections would be empty frames. Say what to do instead.
  const isFreshRun = totalCaught === 0 && stats.totalDeaths === 0;

  return (
    <div>
      <PageHeader title={t.heading} />

      {/* Progress: the same two bars shown on the Encounter and Journey
          tabs, just bigger. Meaningful even at zero, so it stays first. */}
      <Section title={t.progress}>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          <div>
            <div className="mb-1 text-xs font-medium text-ink-muted">{t.encounterProgress}</div>
            <ProgressBar
              size="md"
              done={routeProgress.done}
              total={routeProgress.total}
              percent={routeProgress.percent}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-ink-muted">{t.battleProgress}</div>
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
      </Section>

      {isFreshRun ? (
        <Section title={t.dashboard}>
          <EmptyState title={t.emptyRun} hint={t.emptyRunHint} />
        </Section>
      ) : (
        <>
          <Section title={t.dashboard}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                value={stats.totalDeaths}
                label={`💀 ${t.totalDeaths}`}
                parts={
                  deathTally
                    ? ([Player.PLAYER1, Player.PLAYER2] as const).map((p) => ({
                        label: playerLabel(p),
                        value: deathTally[p],
                      }))
                    : undefined
                }
                footnote={
                  deathTally && deathTally.unattributed > 0
                    ? t.deathTallyUnattributed(deathTally.unattributed)
                    : undefined
                }
              />
              <StatTile
                value={totalCaught}
                label={t.caughtTotal}
                parts={splitBy((r) => r.caught)}
              />
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
              <StatTile
                size="sm"
                value={`${stats.teamSumme} → ${stats.teamSummeMax}`}
                label={t.teamBst}
                labelHint={t.teamBstColHint}
                parts={splitBy((r) => `${r.teamSumme} → ${r.teamSummeMax}`)}
              />
              <StatTile
                size="sm"
                value={`${bankSumme} → ${bankSummeMax}`}
                label={t.bankBst}
                labelHint={t.bankBstColHint}
                parts={splitBy((r) => `${r.bankSumme} → ${r.bankSummeMax}`)}
              />
            </div>
          </Section>

          {/* Team coverage: defensive (reused) + offensive gaps */}
          <Section title={t.coverage}>
            <Card className="mb-4">
              <TeamWeaknessesView
                lang={lang}
                mode={mode}
                teams={teams}
                table={table}
                attackTypes={attackTypes}
              />
            </Card>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
              {offensiveGaps.map(
                (o) =>
                  teams.find((tm) => tm.player === o.player && tm.members.length > 0) && (
                    <Card key={o.player} className="min-w-[260px] flex-1">
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {t.offensiveGaps}
                        {!isClassic && (
                          <span className="font-normal text-ink-subtle">
                            · {playerLabel(o.player)}
                          </span>
                        )}
                        <span
                          className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-line-strong font-serif text-xs italic text-ink-subtle"
                          title={t.offensiveGapsInfo(coverageLevel)}
                        >
                          i
                        </span>
                      </h3>
                      {o.gaps.length === 0 ? (
                        <p className="text-sm text-success">{t.noGaps}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {o.gaps.map((ty) => (
                            <span key={ty} className="inline-flex items-center gap-1">
                              <TypeBadge type={ty} lang={lang} />
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-ink-subtle">{t.offensiveHint}</p>
                    </Card>
                  ),
              )}
            </div>
          </Section>
        </>
      )}

      {/* Badges sit down here rather than under the progress bars: they are a
          record of what has happened, which is the same job the Memorial does,
          and the dashboard is what you open this tab for. */}
      <Section title={t.badgesHeading}>
        {badges.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.badgesEmpty}</p>
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
      </Section>

      {/* Memorial / graveyard */}
      <Section title={`💀 ${t.memorial}`}>
        {memorial.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.memorialEmpty}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {memorial.map((m) => (
              <li
                key={m.soulLinkId}
                className="rounded-lg border border-danger-line bg-danger-bg/40 p-3 opacity-90"
              >
                <div className="mb-1 text-xs font-medium text-ink-muted">{m.routeName}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.pokemon.map((p, i) => {
                    // Sprite + name together open the Pokédex card, same as
                    // the sprite does on the Team/Encounter tabs.
                    const body = (
                      <>
                        <PokemonSprite pokemonId={p.id} name={p.species ?? p.name} size="sm" />
                        <span className="text-sm text-ink">
                          {p.name}
                          {p.species && <span className="text-ink-subtle"> ({p.species})</span>}
                        </span>
                      </>
                    );
                    return detail ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => detail.open(p.id)}
                        title={p.species ?? p.name}
                        className="flex min-h-10 cursor-pointer items-center gap-1 rounded-md transition-opacity hover:opacity-70"
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
                  <div className="mt-1 text-xs text-danger">
                    {m.deathPlayer && tLinks.deadBy(playerLabel(m.deathPlayer))}
                    {m.deathPlayer && m.deathCause ? " · " : ""}
                    {m.deathCause}
                  </div>
                )}
                <div className="mt-1.5">
                  <DeathPointPicker
                    runId={runId}
                    lang={lang}
                    soulLinkId={m.soulLinkId}
                    current={m.deathLevelCapId}
                    recorded={m.recorded}
                    options={deathPointOptions}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
