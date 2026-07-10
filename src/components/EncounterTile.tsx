"use client";

import type { EncounterView } from "@/lib/types";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";

// One Pokémon's display inside a link/team card: sprite, name, types, the
// player·status·static line and the rank·summe line. Shared so the Team tiles
// and the Links list render pixel-identically. `children` slots in any extra
// controls (e.g. the evolve/revert buttons in the Links list).
export function EncounterTile({
  encounter,
  isDead,
  isClassic,
  lang,
  children,
}: {
  encounter: EncounterView;
  isDead: boolean;
  isClassic: boolean;
  lang: Lang;
  children?: React.ReactNode;
}) {
  const t = translations[lang];
  return (
    <div className="flex w-full max-w-[160px] flex-col items-center gap-1 text-center">
      <PokemonSprite pokemonId={encounter.pokemonId} name={encounter.pokemonName} size="xl" />
      <span
        className={`font-medium ${isDead ? "text-zinc-400 line-through dark:text-zinc-600" : ""}`}
      >
        {encounter.pokemonName}
      </span>
      <div className="flex flex-wrap justify-center gap-1">
        {encounter.types.map((type) => (
          <TypeBadge key={type} type={type} lang={lang} />
        ))}
      </div>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {isClassic ? "" : `${t.player[encounter.player]} · `}
        {t.status[encounter.status]}
        {encounter.isStatic ? ` · ${t.links.staticTag}` : ""}
      </span>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {t.links.rankSummary(encounter.rang, encounter.summe)}
      </span>
      {children}
    </div>
  );
}
