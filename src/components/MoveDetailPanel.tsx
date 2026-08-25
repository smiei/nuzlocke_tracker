"use client";

import type { ReactNode } from "react";
import type { MoveDamageClass, MoveDetail } from "@/lib/learnset";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

// Physical/special get the games' own colour coding so the category reads at
// a glance - a deliberate exception to the semantic palette, the same one
// TypeBadge makes for types. Status has no such convention, so it uses the
// neutral surface tokens.
const DAMAGE_CLASS_STYLES: Record<MoveDamageClass, string> = {
  physical: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  special: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  status: "bg-sunken text-ink-muted",
};

// One value tile. `hint` carries the modern value when this generation's
// differs (e.g. "heute 90").
function MoveStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md bg-panel px-2 py-2">
      <div className="text-xs uppercase tracking-wide text-ink-subtle">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="text-xs text-ink-subtle">{hint}</div>}
    </div>
  );
}

// Power/accuracy/PP/category tiles plus the localized effect text, for one
// move resolved to the run's generation. Shared by the Pokédex card's
// expandable level-up rows and the TMs tab's selected-move summary.
export function MoveDetailPanel({
  move,
  lang,
  className = "",
}: {
  move: MoveDetail;
  lang: Lang;
  className?: string;
}) {
  const td = translations[lang].pokedex.detail;
  // Status moves have no power, and a few moves never miss (accuracy null).
  const num = (value: number | null) => (value == null ? "—" : String(value));

  return (
    <div className={`rounded-md border border-line bg-sunken p-2 text-sm ${className}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MoveStat
          label={td.movePower}
          value={num(move.power)}
          hint={move.modernPower !== undefined ? td.moveToday(num(move.modernPower)) : undefined}
        />
        <MoveStat
          label={td.moveAccuracy}
          value={num(move.accuracy)}
          hint={
            move.modernAccuracy !== undefined ? td.moveToday(num(move.modernAccuracy)) : undefined
          }
        />
        <MoveStat label={td.movePp} value={num(move.pp)} />
        <MoveStat
          label={td.moveCategory}
          value={
            <span
              className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                DAMAGE_CLASS_STYLES[move.damageClass]
              }`}
            >
              {td.moveClass[move.damageClass]}
            </span>
          }
          hint={
            move.modernDamageClass !== undefined
              ? td.moveToday(td.moveClass[move.modernDamageClass])
              : undefined
          }
        />
      </div>
      {move.flavor && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink-subtle">
            {td.moveEffect}
            {move.effectChance != null && ` · ${td.moveChance(move.effectChance)}`}
          </div>
          <p className="leading-relaxed text-ink-muted">{move.flavor}</p>
        </div>
      )}
    </div>
  );
}
