"use client";

import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { computeDefenseMultipliers, singleTypeMultiplier } from "@/lib/effectiveness";
import type { Learnset } from "@/lib/learnset";
import { attackTypesAtLevel } from "@/lib/learnset";
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
      className={`inline-flex h-7 w-8 items-center justify-center rounded text-[10px] font-semibold uppercase text-white transition-opacity ${
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
function matrixCellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 2) return { text: "2", className: "bg-green-500 text-white dark:bg-green-600" };
  if (multiplier === 0.5) return { text: "½", className: "bg-red-500 text-white dark:bg-red-600" };
  if (multiplier === 0) return { text: "0", className: "bg-zinc-900 text-zinc-100 dark:bg-black dark:text-zinc-400" };
  return { text: "", className: "bg-zinc-100 dark:bg-zinc-800/60" };
}

// Team-matchup cell (defender view: how the team member takes the opponent's
// attack). Red = takes more, green = resists, black = immune.
function matchupCellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 4) return { text: "4", className: "bg-red-600 text-white" };
  if (multiplier === 2) return { text: "2", className: "bg-orange-500 text-white" };
  if (multiplier === 0.5) return { text: "½", className: "bg-green-500 text-white" };
  if (multiplier === 0.25) return { text: "¼", className: "bg-green-700 text-white" };
  if (multiplier === 0)
    return { text: "0", className: "bg-zinc-900 text-zinc-300 dark:bg-black dark:text-zinc-400" };
  return { text: "1", className: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" };
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
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.levelLabel}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            {...levelInput}
            className="w-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          />
          <button
            type="button"
            onClick={() => onChange({ level: 100 })}
            className="rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            100
          </button>
        </div>
      </div>

      {selectedRaw === null ? (
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">{t.battleHint}</p>
      ) : (
        <div className="mb-8 space-y-4">
          {/* Stats: the opponent's own types + its damaging attack types. */}
          <section className="max-w-2xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {t.statsHeading}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {opponentTypes.map((type) => (
                <TypeBadge key={type} type={type} lang={lang} />
              ))}
            </div>

            {/* Opponent's damaging attack types at the chosen level */}
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t.moveTypes} <span className="font-normal normal-case">· {t.damagingOnly}</span>
              </div>
              {allAttacks.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allAttacks.map(({ type, level: lvl }) => (
                    // Types not yet learnable at the entered level are dimmed.
                    <span
                      key={type}
                      className={`inline-flex items-center gap-1 ${lvl > level ? "opacity-20" : ""}`}
                    >
                      <TypeBadge type={type} lang={lang} />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {translations[lang].pokedex.detail.level(lvl)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Weaknesses as a defender: which attack types to hit it with. */}
          {multipliers && (
            <section className="max-w-2xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                {t.defenderWeakHeading}
              </h3>
              <div className="flex flex-col gap-2">
                {MULTIPLIER_GROUPS.map((group) => {
                  const types = attackTypes.filter((a) => multipliers[a] === group);
                  if (types.length === 0) return null;
                  return (
                    <div key={group} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-52 shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-300">
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
          {opponentAttackTypes.length > 0 &&
            (!hasTeam ? (
              <section className="max-w-2xl rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  {t.teamStrengthHeading}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {translations[lang].weaknesses.empty}
                </p>
              </section>
            ) : (
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                {teams.map(
                  (team) =>
                    team.members.length > 0 && (
                      <section
                        key={team.player}
                        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                      >
                        <h3 className="mb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                          {t.teamStrengthHeading}
                          {mode !== "CLASSIC" && (
                            <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
                              · {playerLabel(team.player)}
                            </span>
                          )}
                        </h3>
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
        <h3 className="mb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {t.matrixHeading}
        </h3>
          <MatrixLegend text={t.legendOffense} />
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="pr-2 text-right align-bottom">
                  <div className="text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
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
