"use client";

import { useState } from "react";
import type { Pokemon } from "@/lib/data";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { computeDefenseMultipliers, singleTypeMultiplier } from "@/lib/effectiveness";
import type { Learnset } from "@/lib/learnset";
import { attackTypesAtLevel } from "@/lib/learnset";
import { TYPE_COLORS, TYPE_LABELS, typesForGeneration } from "@/lib/pokemonTypes";
import type { Player, RunMode } from "@/generated/prisma/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { PokemonSprite } from "@/components/PokemonSprite";
import { TypeBadge } from "@/components/TypeBadge";
import type { TeamMember } from "@/components/TeamWeaknessesView";

const EMPTY_LOCKS = new Set<number>();
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
  const memberMults = members.map((m) => computeDefenseMultipliers(table, m.types, attackTypes));
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 sm:border-spacing-1">
        <thead>
          <tr>
            <th aria-hidden />
            {members.map((m) => (
              <th key={m.encounterId} className="p-0 pb-1 text-center" title={m.name}>
                <PokemonSprite pokemonId={m.pokemonId} name={m.name} size="md" className="mx-auto h-8 w-8 sm:h-11 sm:w-11" />
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

export function BattleView({
  pokemonList,
  table,
  attackTypes,
  generation,
  learnset,
  teams,
  mode,
}: {
  pokemonList: Pokemon[];
  table: EffectivenessTable;
  // Gen-appropriate attack type list for the matrix (Gen 1 lacks Dark/Steel).
  attackTypes: string[];
  generation: number;
  learnset: Learnset;
  teams: { player: Player; members: TeamMember[] }[];
  mode: RunMode;
}) {
  const { lang } = useLanguage();
  const t = translations[lang].typen;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [level, setLevel] = useState(100);

  const selectedRaw = pokemonList.find((p) => p.id === selectedId) ?? null;
  const opponentTypes = selectedRaw
    ? typesForGeneration(selectedRaw.id, selectedRaw.types, generation)
    : [];
  const opponentAttacks = selectedRaw ? attackTypesAtLevel(learnset, selectedRaw.id, level) : [];
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
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.battleHeading}</h2>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-sm flex-1">
          <PokemonCombobox
            lang={lang}
            pokemonList={pokemonList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            lockedFamilyIds={EMPTY_LOCKS}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {t.levelLabel}
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={(e) => {
              const n = Number(e.target.value);
              setLevel(Number.isFinite(n) ? Math.min(100, Math.max(1, Math.round(n))) : 100);
            }}
            className="w-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          />
        </div>
      </div>

      {selectedRaw === null ? (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{t.battleHint}</p>
      ) : (
        <div className="mb-6 max-w-2xl space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {/* Opponent's own types */}
          <div className="flex flex-wrap items-center gap-2">
            {opponentTypes.map((type) => (
              <TypeBadge key={type} type={type} lang={lang} />
            ))}
          </div>

          {/* Opponent's damaging attack types at the chosen level */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.moveTypes} <span className="font-normal normal-case">· {t.damagingOnly}</span>
            </div>
            {opponentAttacks.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {opponentAttacks.map(({ type, level: lvl }) => (
                  <span key={type} className="inline-flex items-center gap-1">
                    <TypeBadge type={type} lang={lang} />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {translations[lang].pokedex.detail.level(lvl)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Opponent's defensive profile (what to attack it with) */}
          {multipliers && (
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
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
          )}
        </div>
      )}

      {/* Full type matrix (gen-aware), dimmed to the opponent's types */}
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

      {/* Team matchup against the opponent's attacks */}
      {selectedRaw !== null && opponentAttackTypes.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {t.teamMatchup}
          </h3>
          {!hasTeam ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {translations[lang].weaknesses.empty}
            </p>
          ) : (
            <div className="flex flex-col gap-6 xl:flex-row xl:gap-10">
              {teams.map(
                (team) =>
                  team.members.length > 0 && (
                    <section key={team.player}>
                      {mode !== "CLASSIC" && (
                        <h4 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {translations[lang].player[team.player]}
                        </h4>
                      )}
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
          )}
        </div>
      )}
    </div>
  );
}
