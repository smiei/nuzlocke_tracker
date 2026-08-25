"use client";

import type { EncounterView } from "@/lib/types";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { TypeBadge } from "@/components/TypeBadge";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePokemonDetail } from "@/components/PokemonDetailProvider";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";

// One Pokémon's display inside a link/team card: sprite on the left, the
// description (name, types, player/static line, rank·BST) and any extra
// controls (evolve/revert buttons via `children`) on the right. Shared so the
// Team tiles and the Links list render pixel-identically. Caught/killed
// status is deliberately not shown - the card's dead styling communicates it.
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
  const detail = usePokemonDetail();
  const playerLabel = usePlayerLabel();
  const infoParts = [
    ...(!isClassic ? [playerLabel(encounter.player)] : []),
    ...(encounter.isStatic ? [t.links.staticTag] : []),
  ];
  return (
    <div className="flex w-full items-center gap-3">
      {detail ? (
        <button
          type="button"
          onClick={() => detail.open(encounter.pokemonId)}
          title={encounter.pokemonName}
          aria-label={encounter.pokemonName}
          className="shrink-0 cursor-pointer rounded transition-opacity hover:opacity-80"
        >
          <PokemonSprite pokemonId={encounter.pokemonId} name={encounter.pokemonName} size="xl" />
        </button>
      ) : (
        <PokemonSprite
          pokemonId={encounter.pokemonId}
          name={encounter.pokemonName}
          size="xl"
          className="shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-col items-start gap-1 text-left">
        <span
          className={`font-medium text-ink ${isDead ? "text-ink-subtle line-through" : ""}`}
        >
          {encounter.shiny && (
            <span className="mr-1" title="Shiny">
              ✨
            </span>
          )}
          {encounter.nickname ?? encounter.pokemonName}
          {encounter.nickname && (
            <span className="ml-1.5 text-xs font-normal text-ink-subtle">
              ({encounter.pokemonName})
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-1">
          {encounter.types.map((type) => (
            <TypeBadge key={type} type={type} lang={lang} />
          ))}
        </div>
        {infoParts.length > 0 && (
          <span className="text-xs text-ink-subtle">
            {infoParts.join(" · ")}
          </span>
        )}
        <span className="text-xs text-ink-subtle">
          {t.links.rankSummary(encounter.rang, encounter.summe)}
        </span>
        {children}
      </div>
    </div>
  );
}
