"use client";

import type { Player, RunMode } from "@/generated/prisma/client";
import type { EffectivenessTable } from "@/lib/effectiveness";
import { GEN3_TYPES, computeDefenseMultipliers } from "@/lib/effectiveness";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/pokemonTypes";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";

export type TeamMember = {
  encounterId: number;
  // What to show (may be an alternate forme).
  pokemonId: number;
  // Species to read species-keyed data under (learnsets); a forme inherits
  // its species' movepool. Equals pokemonId for everything else.
  speciesId: number;
  name: string;
  types: string[];
};

// Defender's view: taking more damage is bad (red/orange), resisting is good
// (green), immune is black. Every background is fully opaque so nothing
// shines through, and 2x (orange) is clearly distinct from both 4x (red)
// and 0x (black).
function cellStyle(multiplier: number): { text: string; className: string } {
  if (multiplier === 4) return { text: "4", className: "bg-eff-bad text-white" };
  if (multiplier === 2) return { text: "2", className: "bg-eff-bad-mild text-white" };
  if (multiplier === 0.5) return { text: "½", className: "bg-eff-good text-white" };
  if (multiplier === 0.25) return { text: "¼", className: "bg-eff-good-deep text-white" };
  if (multiplier === 0) return { text: "0", className: "bg-eff-none text-eff-none-ink" };
  return { text: "", className: "bg-sunken" };
}

// Larger stand-alone type badge (the shared TypeBadge is sized for compact
// card captions); scales down below `sm` so the table fits phone screens.
function BigTypeBadge({ type, lang }: { type: string; lang: Lang }) {
  return (
    <span
      className="inline-block rounded-md px-1.5 py-0.5 text-xs font-medium text-white sm:px-2.5 sm:py-1 sm:text-sm"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {TYPE_LABELS[lang][type] ?? type}
    </span>
  );
}

function TeamTable({
  members,
  table,
  attackTypes,
  lang,
}: {
  members: TeamMember[];
  table: EffectivenessTable;
  attackTypes: string[];
  lang: Lang;
}) {
  const t = translations[lang].weaknesses;
  const detail = usePokemonDetail();

  const memberMults = members.map((m) =>
    computeDefenseMultipliers(table, m.types, attackTypes),
  );

  const rows = attackTypes.map((attack, order) => {
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
    <>
      {/* Phone: one line per attack type. A 17 x 6 grid of multipliers does not
          survive a 390px screen, and the question there is "what threatens the
          team", which the two counts answer on their own. */}
      <ul className="flex flex-col gap-1 md:hidden">
        {rows.map((row) => (
          <li
            key={row.attack}
            className={`flex items-center gap-2 rounded-md px-2 py-2 ${
              row.critical ? "bg-danger-bg" : ""
            }`}
          >
            {row.critical && (
              <span className="text-danger" title={t.criticalHint}>
                ⚠
              </span>
            )}
            <BigTypeBadge type={row.attack} lang={lang} />
            <span className="ml-auto flex items-center gap-3 text-sm tabular-nums">
              <span className={row.weak > 0 ? "font-semibold text-danger" : "text-ink-subtle"}>
                {row.weak} {t.weakHeader}
              </span>
              <span className={row.resist > 0 ? "font-semibold text-success" : "text-ink-subtle"}>
                {row.resist} {t.resistHeader}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
      <table className="border-separate border-spacing-0.5 sm:border-spacing-1">
        <thead>
          <tr>
            <th className="pr-1.5 text-left text-xs font-medium text-ink-subtle sm:pr-3">
              {t.attackType}
            </th>
            {members.map((m) => (
              <th key={m.encounterId} className="p-0 pb-1 text-center" title={m.name}>
                {detail ? (
                  <button
                    type="button"
                    onClick={() => detail.open(m.pokemonId)}
                    aria-label={m.name}
                    className="mx-auto block cursor-pointer rounded transition-opacity hover:opacity-80"
                  >
                    <PokemonSprite
                      pokemonId={m.pokemonId}
                      name={m.name}
                      size="md"
                      className="mx-auto h-8 w-8 sm:h-12 sm:w-12"
                    />
                  </button>
                ) : (
                  <PokemonSprite
                    pokemonId={m.pokemonId}
                    name={m.name}
                    size="md"
                    className="mx-auto h-8 w-8 sm:h-12 sm:w-12"
                  />
                )}
              </th>
            ))}
            <th className="px-1 text-center text-xs font-medium text-danger sm:px-3">
              {t.weakHeader}
            </th>
            <th className="px-1 text-center text-xs font-medium text-success sm:px-3">
              {t.resistHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attack}>
              <td className="whitespace-nowrap py-0.5 pr-1.5 sm:py-1 sm:pr-3">
                {/* Critical marker on the label instead of a row background -
                    a <tr> bg bleeds through the border-spacing gaps. */}
                {row.critical && (
                  <span
                    className="mr-1 text-xs text-danger sm:mr-1.5 sm:text-base"
                    title={t.criticalHint}
                  >
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
                    className={`h-8 w-9 rounded text-center text-sm font-semibold sm:h-12 sm:w-14 sm:rounded-md sm:text-lg ${className}`}
                  >
                    {text}
                  </td>
                );
              })}
              <td className="px-1 text-center sm:px-3">
                <span
                  className={`inline-block min-w-[1.5rem] rounded px-1 py-0.5 text-sm font-semibold tabular-nums sm:min-w-[2rem] sm:rounded-md sm:px-2 sm:py-1 sm:text-lg ${
                    row.critical
                      ? "bg-eff-bad text-white"
                      : row.weak > 0
                        ? "text-danger"
                        : "text-ink-subtle"
                  }`}
                >
                  {row.weak}
                </span>
              </td>
              <td
                className={`px-1 text-center text-sm font-semibold tabular-nums sm:px-3 sm:text-lg ${
                  row.resist > 0 ? "text-success" : "text-ink-subtle"
                }`}
              >
                {row.resist}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export function TeamWeaknessesView({
  lang,
  mode,
  teams,
  table,
  attackTypes = GEN3_TYPES,
}: {
  lang: Lang;
  mode: RunMode;
  teams: { player: Player; members: TeamMember[] }[];
  table: EffectivenessTable;
  // Gen 1 games have no Dark/Steel rows.
  attackTypes?: string[];
}) {
  const t = translations[lang];
  const playerLabel = usePlayerLabel();
  const hasAnyMembers = teams.some((team) => team.members.length > 0);

  return (
    <div>
      {/* h3, not the page-title-sized h2 it used to be: this block sits
          inside the Overview's "Team coverage" section. */}
      <h3 className="mb-4 text-sm font-semibold text-ink">{t.weaknesses.heading}</h3>
      {!hasAnyMembers ? (
        <p className="text-sm text-ink-muted">{t.weaknesses.empty}</p>
      ) : (
        <>
          <div className="flex flex-col gap-8 xl:flex-row xl:gap-12">
            {teams.map(
              (team) =>
                team.members.length > 0 && (
                  <section key={team.player}>
                    {mode !== "CLASSIC" && (
                      <h4 className="mb-2 text-sm font-semibold text-ink-muted">
                        {playerLabel(team.player)}
                      </h4>
                    )}
                    <TeamTable
                      members={team.members}
                      table={table}
                      attackTypes={attackTypes}
                      lang={lang}
                    />
                  </section>
                ),
            )}
          </div>
          <p className="mt-5 max-w-prose text-sm text-ink-subtle">
            {t.weaknesses.criticalHint}
          </p>
        </>
      )}
    </div>
  );
}
