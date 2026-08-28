"use client";

import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { computeDefenseMultipliers, singleTypeMultiplier } from "@/lib/effectiveness";
import type { Learnset } from "@/lib/learnset";
import { attackTypesAtLevel } from "@/lib/learnset";
import { BlindflugNotice, useBlindflug } from "@/components/BlindflugProvider";
import { movepoolId } from "@/lib/forms";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/pokemonTypes";
import { useClampedIntInput } from "@/lib/useClampedIntInput";
import type { Player, RunMode } from "@/generated/prisma/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeBadge } from "@/components/TypeBadge";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";
import type { TeamMember } from "@/components/TeamWeaknessesView";

const MULTIPLIER_GROUPS = [4, 2, 0.5, 0.25, 0] as const;

function TypeAbbrev({ type, lang, dimmed }: { type: string; lang: Lang; dimmed: boolean }) {
  const label = TYPE_LABELS[lang][type] ?? type;
  return (
    <span
      title={label}
      className={`inline-flex h-7 w-8 items-center justify-center rounded-md text-xs font-semibold uppercase text-white transition-opacity ${
        dimmed ? "opacity-25" : ""
      }`}
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {label.slice(0, 3)}
    </span>
  );
}

// Both matrices are coloured from the PLAYER's point of view - green always
// means "good for you". That is consistent, but it also means the same green
// carries a 2 in the offensive matrix and a fraction in the defensive one, and
// with both tables on screen at once that reads as a contradiction unless the
// framing is stated. Hence the legend under each heading.
function MatrixLegend({ text }: { text: string }) {
  return <p className="mb-2 text-xs text-ink-subtle">{text}</p>;
}

// Matrix cell (attacker vs defender, offensive view): green = super effective.
// The fills come from the --eff-* scale, not from --success / --danger: those
// are text colours and wash out as a cell fill (see globals.css).
function matrixCellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 2) return { text: "2", className: "bg-eff-good text-white" };
  if (multiplier === 0.5) return { text: "½", className: "bg-eff-bad text-white" };
  if (multiplier === 0) return { text: "0", className: "bg-eff-none text-eff-none-ink" };
  return { text: "", className: "bg-sunken" };
}

// Team-matchup cell (defender view: how the team member takes the opponent's
// attack). Red = takes more, green = resists, black = immune.
//
// Five ordered steps out of the shared --eff-* scale: two depths of green for
// the two resistances, two of red/orange for the two weaknesses, black for
// immune. The depth carries the ordering, which is why 1/4x is a deeper green
// rather than a different hue.
function matchupCellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 4) return { text: "4", className: "bg-eff-bad text-white" };
  if (multiplier === 2) return { text: "2", className: "bg-eff-bad-mild text-white" };
  if (multiplier === 0.5) return { text: "½", className: "bg-eff-good text-white" };
  if (multiplier === 0.25) return { text: "¼", className: "bg-eff-good-deep text-white" };
  if (multiplier === 0) return { text: "0", className: "bg-eff-none text-eff-none-ink" };
  return { text: "1", className: "bg-sunken text-ink-subtle" };
}

// One team's defensive matchup against the opponent's damaging attack types.
function TeamMatchup({
  members,
  attackTypes,
  table,
  lang,
}: {
  members: TeamMember[];
  attackTypes: string[];
  table: EffectivenessTable;
  lang: Lang;
}) {
  const detail = usePokemonDetail();
  const memberMults = members.map((m) => computeDefenseMultipliers(table, m.types, attackTypes));
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 sm:border-spacing-1">
        <thead>
          <tr>
            <th aria-hidden />
            {members.map((m) => (
              <th key={m.encounterId} className="p-0 pb-1 text-center" title={m.name}>
                <button
                  type="button"
                  onClick={() => detail?.open(m.pokemonId)}
                  className="cursor-pointer rounded transition-opacity hover:opacity-80"
                  title={m.name}
                >
                  <PokemonSprite pokemonId={m.pokemonId} name={m.name} size="md" className="mx-auto h-8 w-8 sm:h-11 sm:w-11" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attackTypes.map((attack) => (
            <tr key={attack}>
              <td className="whitespace-nowrap py-0.5 pr-2">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: TYPE_COLORS[attack] ?? "#777" }}
                >
                  {TYPE_LABELS[lang][attack] ?? attack}
                </span>
              </td>
              {members.map((m, i) => {
                const { text, className } = matchupCellStyle(memberMults[i][attack]);
                return (
                  <td
                    key={m.encounterId}
                    className={`h-8 w-9 rounded text-center text-sm font-semibold sm:h-11 sm:w-12 sm:text-base ${className}`}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type BattleSharedProps = {
  pokemonList: Pokemon[];
  table: EffectivenessTable;
  // Gen-appropriate attack type list for the matrix (Gen 1 lacks Dark/Steel).
  attackTypes: string[];
  learnset: Learnset;
  teams: { player: Player; members: TeamMember[] }[];
  mode: RunMode;
  // Pokémon (by id) that learn self-destruct/explosion, with the localized
  // move name + lowest level (derived server-side from the moveset).
  explosiveMap: Record<number, { name: string; level: number }>;
};

// The "Trainer" body of a combined card: an opponent level with its stats,
// defensive weaknesses, the team matchup, and the full type matrix. The Pokémon
// is picked once in the card header and handed down as selectedId.
export function BattleCardBody({
  shared,
  selectedId,
  level,
  onChange,
}: {
  shared: BattleSharedProps;
  selectedId: number | null;
  level: number;
  onChange: (patch: { level: number }) => void;
}) {
  const { pokemonList, table, attackTypes, learnset, teams, mode } = shared;
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const playerLabel = usePlayerLabel();
  const blindflug = useBlindflug();
  const levelInput = useClampedIntInput(level, 1, 100, 100, (n) => onChange({ level: n }));

  const selectedRaw = pokemonList.find((p) => p.id === selectedId) ?? null;
  const opponentTypes = selectedRaw
    ? selectedRaw.types
    : [];
  // Stats card lists ALL damaging attack types (every level), independent of
  // the entered level. The team matchup below only counts types reachable by
  // the entered level.
  // Formes with their own movepool (Deoxys, Wormadam, Shaymin) get their own
  // learnset rows; the rest fall back to their species.
  const learnsetId = selectedRaw
    ? movepoolId(selectedRaw, (id) => learnset[String(id)] !== undefined)
    : 0;
  const allAttacks = selectedRaw ? attackTypesAtLevel(learnset, learnsetId, 100) : [];
  const opponentAttacks = selectedRaw ? attackTypesAtLevel(learnset, learnsetId, level) : [];
  const opponentAttackTypes = opponentAttacks.map((a) => a.type);

  const multipliers = selectedRaw ? computeDefenseMultipliers(table, opponentTypes, attackTypes) : null;
  const groupLabels: Record<(typeof MULTIPLIER_GROUPS)[number], string> = {
    4: t.weak4,
    2: t.weak2,
    0.5: t.resist2,
    0.25: t.resist4,
    0: t.immune,
  };
  const isDimmed = (defenseType: string) => selectedRaw !== null && !opponentTypes.includes(defenseType);

  const hasTeam = teams.some((team) => team.members.length > 0);

  return (
    <>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-ink-muted">
          {t.levelLabel}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            {...levelInput}
            className="h-11 w-20 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => onChange({ level: 100 })}
            className="inline-flex h-11 shrink-0 items-center rounded-md border border-line-strong px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
          >
            100
          </button>
        </div>
      </div>

      {selectedRaw === null ? (
        <p className="mb-8 text-sm text-ink-muted">{t.battleHint}</p>
      ) : (
        <div className="mb-8 divide-y divide-line">
          {/* Stats: the opponent's own types + its damaging attack types. */}
          <section className="pb-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t.statsHeading}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {opponentTypes.map((type) => (
                <TypeBadge key={type} type={type} lang={lang} />
              ))}
            </div>

            {/* Opponent's damaging attack types at the chosen level. Under
                Blindflug the heading stays and only the types go - it is what
                names what is being withheld. */}
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t.moveTypes} <span className="font-normal normal-case">· {t.damagingOnly}</span>
              </div>
              {blindflug ? (
                <BlindflugNotice />
              ) : allAttacks.length === 0 ? (
                <p className="text-xs text-ink-subtle">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allAttacks.map(({ type, level: lvl }) => (
                    // Types not yet learnable at the entered level are dimmed.
                    <span
                      key={type}
                      className={`inline-flex items-center gap-1 ${lvl > level ? "opacity-20" : ""}`}
                    >
                      <TypeBadge type={type} lang={lang} />
                      <span className="text-xs text-ink-subtle">
                        {translations[lang].pokedex.detail.level(lvl)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Weaknesses as a defender: which attack types to hit it with. */}
          {!blindflug && multipliers && (
            <section className="py-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {t.defenderWeakHeading}
              </h2>
              <div className="flex flex-col gap-2">
                {MULTIPLIER_GROUPS.map((group) => {
                  const types = attackTypes.filter((a) => multipliers[a] === group);
                  if (types.length === 0) return null;
                  return (
                    <div key={group} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-52 shrink-0 text-sm font-medium text-ink-muted">
                        {groupLabels[group]}:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {types.map((type) => (
                          <TypeBadge key={type} type={type} lang={lang} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Strengths against my team: opponent's attacks vs each member.
              One card in Classic, one per player in SoulLink. */}
          {!blindflug &&
            opponentAttackTypes.length > 0 &&
            (!hasTeam ? (
              <section className="py-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">
                  {t.teamStrengthHeading}
                </h2>
                <p className="text-sm text-ink-muted">
                  {translations[lang].weaknesses.empty}
                </p>
              </section>
            ) : (
              <div className="flex flex-col gap-6 py-4 xl:flex-row xl:items-start">
                {teams.map(
                  (team) =>
                    team.members.length > 0 && (
                      <section
                        key={team.player}
                        className="min-w-0 flex-1"
                      >
                        <h2 className="mb-1 text-sm font-semibold text-ink">
                          {t.teamStrengthHeading}
                          {mode !== "CLASSIC" && (
                            <span className="ml-2 font-normal text-ink-subtle">
                              · {playerLabel(team.player)}
                            </span>
                          )}
                        </h2>
                        <MatrixLegend text={t.legendDefense} />
                        <TeamMatchup
                          members={team.members}
                          attackTypes={opponentAttackTypes}
                          table={table}
                          lang={lang}
                        />
                      </section>
                    ),
                )}
              </div>
            ))}
        </div>
      )}

      {/* Full type matrix (gen-aware) at the very bottom, dimmed to the opponent. */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">
          {t.matrixHeading}
        </h2>
          <MatrixLegend text={t.legendOffense} />
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="pr-2 text-right align-bottom">
                  <div className="text-xs font-medium leading-tight text-ink-subtle">
                    <div>{t.defense} →</div>
                    <div>{t.attack} ↓</div>
                  </div>
                </th>
                {attackTypes.map((defense) => (
                  <th key={defense} className="p-0">
                    <TypeAbbrev type={defense} lang={lang} dimmed={isDimmed(defense)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attackTypes.map((attack) => (
                <tr key={attack}>
                  <th className="p-0 pr-1 text-right">
                    <TypeAbbrev type={attack} lang={lang} dimmed={false} />
                  </th>
                  {attackTypes.map((defense) => {
                    const { text, className } = matrixCellStyle(singleTypeMultiplier(table, attack, defense));
                    return (
                      <td
                        key={defense}
                        className={`h-7 w-8 rounded text-center text-xs font-semibold transition-opacity ${className} ${
                          isDimmed(defense) ? "opacity-25" : ""
                        }`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
