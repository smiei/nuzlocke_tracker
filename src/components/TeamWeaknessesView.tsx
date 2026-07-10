"use client";

import type { Player, RunMode } from "@/generated/prisma/client";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { GEN3_TYPES, computeDefenseMultipliers } from "@/lib/effectiveness";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/pokemonTypes";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";

export type TeamMember = {
  encounterId: number;
  pokemonId: number;
  name: string;
  types: string[];
};

// Defender's view: taking more damage is bad (red/orange), resisting is good
// (green), immune is black. Every background is fully opaque so nothing
// shines through, and 2x (orange) is clearly distinct from both 4x (red)
// and 0x (black).
function cellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 4) return { text: "4", className: "bg-red-600 text-white" };
  if (multiplier === 2) return { text: "2", className: "bg-orange-500 text-white" };
  if (multiplier === 0.5) return { text: "½", className: "bg-green-500 text-white" };
  if (multiplier === 0.25) return { text: "¼", className: "bg-green-700 text-white" };
  if (multiplier === 0)
    return { text: "0", className: "bg-zinc-900 text-zinc-300 dark:bg-black dark:text-zinc-400" };
  return { text: "", className: "bg-zinc-100 dark:bg-zinc-800" };
}

// Larger stand-alone type badge (the shared TypeBadge is sized for compact
// card captions - this view is deliberately twice as big).
function BigTypeBadge({ type, lang }: { type: string; lang: Lang }) {
  return (
    <span
      className="inline-block rounded px-2.5 py-1 text-sm font-medium text-white"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {TYPE_LABELS[lang][type] ?? type}
    </span>
  );
}

function TeamTable({
  members,
  table,
  lang,
}: {
  members: TeamMember[];
  table: EffectivenessTable;
  lang: Lang;
}) {
  const t = translations[lang].weaknesses;

  const memberMults = members.map((m) => computeDefenseMultipliers(table, m.types));

  const rows = GEN3_TYPES.map((attack, order) => {
    const mults = memberMults.map((mm) => mm[attack]);
    const weak = mults.filter((m) => m > 1).length;
    const resist = mults.filter((m) => m < 1).length;
    // Team-wide danger: hits at least half the team super-effectively and
    // nobody on the team resists or is immune.
    const critical = members.length > 0 && weak >= Math.ceil(members.length / 2) && resist === 0;
    return { attack, mults, weak, resist, critical, order };
  }).sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      b.weak - a.weak ||
      a.resist - b.resist ||
      a.order - b.order,
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="pr-3 text-left text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {t.attackType}
            </th>
            {members.map((m) => (
              <th key={m.encounterId} className="p-0 pb-1 text-center" title={m.name}>
                <PokemonSprite pokemonId={m.pokemonId} name={m.name} size="md" className="mx-auto" />
              </th>
            ))}
            <th className="px-3 text-center text-xs font-medium text-red-500 dark:text-red-400">
              {t.weakHeader}
            </th>
            <th className="px-3 text-center text-xs font-medium text-green-600 dark:text-green-400">
              {t.resistHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attack}>
              <td className="whitespace-nowrap py-1 pr-3">
                {/* Critical marker on the label instead of a row background -
                    a <tr> bg bleeds through the border-spacing gaps. */}
                {row.critical && (
                  <span className="mr-1.5 text-base text-red-500 dark:text-red-400" title={t.criticalHint}>
                    ⚠
                  </span>
                )}
                <BigTypeBadge type={row.attack} lang={lang} />
              </td>
              {row.mults.map((m, i) => {
                const { text, className } = cellStyle(m);
                return (
                  <td
                    key={members[i].encounterId}
                    className={`h-12 w-14 rounded-md text-center text-lg font-semibold ${className}`}
                  >
                    {text}
                  </td>
                );
              })}
              <td className="px-3 text-center">
                <span
                  className={`inline-block min-w-[2rem] rounded-md px-2 py-1 text-lg font-semibold tabular-nums ${
                    row.critical
                      ? "bg-red-600 text-white"
                      : row.weak > 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  {row.weak}
                </span>
              </td>
              <td
                className={`px-3 text-center text-lg font-semibold tabular-nums ${
                  row.resist > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-zinc-300 dark:text-zinc-700"
                }`}
              >
                {row.resist}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamWeaknessesView({
  lang,
  mode,
  teams,
  table,
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TeamMember[] }[];
  table: EffectivenessTable;
}) {
  const t = translations[lang];
  const hasAnyMembers = teams.some((team) => team.members.length > 0);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t.weaknesses.heading}</h2>
      {!hasAnyMembers ? (
        <p className="text-zinc-500 dark:text-zinc-400">{t.weaknesses.empty}</p>
      ) : (
        <>
          <div className="flex flex-col gap-8 xl:flex-row xl:gap-12">
            {teams.map(
              (team) =>
                team.members.length > 0 && (
                  <section key={team.player}>
                    {mode !== "CLASSIC" && (
                      <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        {t.player[team.player]}
                      </h3>
                    )}
                    <TeamTable members={team.members} table={table} lang={lang} />
                  </section>
                ),
            )}
          </div>
          <p className="mt-5 max-w-2xl text-sm text-zinc-400 dark:text-zinc-500">
            {t.weaknesses.criticalHint}
          </p>
        </>
      )}
    </div>
  );
}
