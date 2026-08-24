import { Fragment } from "react";
import { computeDefenseMultipliers, type EffectivenessTable } from "@/lib/effectiveness";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { TypeBadge } from "@/components/TypeBadge";
import { cn } from "./cn";

// Shared defensive-matchup block, replacing three near-identical hand-rolls in
// PokemonDetailModal, CatchRateView and BattleView (two of which also duplicated
// the multiplier grouping itself).
//
// The label column used to spell each relation out - "0.25x Starke Resistenz
// gegen:" - which is the whole problem. It is not that the rows failed to align
// (the grid always did that correctly); it is that a column that wide squeezes
// the badge cell, so the first group wraps onto a second line and leaves a hole
// under its label that READS as misalignment. A fixed-width multiplier chip
// gives the badges roughly 60% more room and most groups stop wrapping.
//
// The chip carries the meaning in text, not colour, so it survives both themes
// and colour-blind readers; the spelled-out phrase stays as the accessible name.
const GROUPS = [4, 2, 0.5, 0.25, 0] as const;

const CHIPS: Record<string, { text: string; tone: string }> = {
  "4": { text: "4\u00d7", tone: "border-danger-line bg-danger-bg text-danger" },
  "2": { text: "2\u00d7", tone: "border-danger-line bg-danger-bg text-danger" },
  "0.5": { text: "\u00bd\u00d7", tone: "border-success-line bg-success-bg text-success" },
  "0.25": { text: "\u00bc\u00d7", tone: "border-success-line bg-success-bg text-success" },
  "0": { text: "0\u00d7", tone: "border-line bg-sunken text-ink-muted" },
};

export function TypeEffectiveness({
  defenderTypes,
  effectiveness,
  attackTypes,
  lang,
  className,
}: {
  defenderTypes: string[];
  effectiveness: EffectivenessTable;
  attackTypes: string[];
  lang: Lang;
  className?: string;
}) {
  const t = translations[lang].typen;
  const labels: Record<string, string> = {
    "4": t.weak4,
    "2": t.weak2,
    "0.5": t.resist2,
    "0.25": t.resist4,
    "0": t.immune,
  };

  // Cheap enough to run per render (18 types) - no memo, no dependency array to
  // get wrong.
  const multipliers = computeDefenseMultipliers(effectiveness, defenderTypes, attackTypes);
  const rows = GROUPS.map((group) => ({
    group,
    types: attackTypes.filter((type) => multipliers[type] === group),
  })).filter((row) => row.types.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2", className)}>
      {rows.map((row) => {
        const chip = CHIPS[String(row.group)];
        const label = labels[String(row.group)];
        return (
          <Fragment key={row.group}>
            <span
              title={label}
              aria-label={label}
              className={cn(
                "inline-flex min-w-11 justify-center rounded-md border px-2 py-1 text-xs font-semibold tabular-nums",
                chip.tone,
              )}
            >
              {chip.text}
            </span>
            <div className="flex flex-wrap gap-1 pt-1">
              {row.types.map((type) => (
                <TypeBadge key={type} type={type} lang={lang} />
              ))}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
