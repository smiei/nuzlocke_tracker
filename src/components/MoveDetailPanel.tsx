"use client";

import type { ReactNode } from "react";
import type { MoveDamageClass, MoveDetail } from "@/lib/learnset";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

// Physical/special/status get the games' own colour coding so the category
// reads at a glance, the same way TypeBadge does for types.
const DAMAGE_CLASS_STYLES: Record<MoveDamageClass, string> = {
  physical: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  special: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  status: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

// One value tile. `hint` carries the modern value when this generation's
// differs (e.g. "heute 90").
function MoveStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded bg-white px-2 py-1.5 dark:bg-zinc-900/60">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
        {value}
      </div>
      {hint && <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{hint}</div>}
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
    <div className={`rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-800/60 ${className}`}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
              className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
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
        <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {td.moveEffect}
            {move.effectChance != null && ` · ${td.moveChance(move.effectChance)}`}
          </div>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{move.flavor}</p>
        </div>
      )}
    </div>
  );
}
