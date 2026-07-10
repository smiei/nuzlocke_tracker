"use client";

import type { EncounterView } from "@/lib/types";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";

// One Pokémon's display inside a link/team card: sprite, name, types, the
// player/static line and the rank·BST line. Shared so the Team tiles and the
// Links list render pixel-identically. Caught/killed status is deliberately
// not shown - the card's visual state (dead styling) already communicates it.
// `children` slots in any extra controls (e.g. evolve/revert buttons).
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
  const infoParts = [
    ...(!isClassic ? [t.player[encounter.player]] : []),
    ...(encounter.isStatic ? [t.links.staticTag] : []),
  ];
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
      {infoParts.length > 0 && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {infoParts.join(" · ")}
        </span>
      )}
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {t.links.rankSummary(encounter.rang, encounter.summe)}
      </span>
      {children}
    </div>
  );
}
