// A single encounter's effective Pokémon: itself, or - Infinite Fusion only -
// the blend of a host and its donor (see CLAUDE.md's Infinite Fusion
// section). links/overview/typen build their per-encounter view model
// through this instead of reading currentPokemonId directly, so a fusion
// looks the same wherever it's shown. Without a bodyId this returns exactly
// what those pages already computed inline before Infinite Fusion existed.
import type { Pokemon, PokemonStats } from "@/lib/data";
import type { Lang } from "@/lib/i18n/dictionary";
import { displayNameWithForm } from "@/lib/forms";
import { bestEvolvedPokemon } from "@/lib/evolutions";
import { computeFusionStats, computeFusionTypes } from "@/lib/fusion";

export type EncounterMon = {
  headId: number;
  // null for an ordinary (non-fusion) encounter.
  bodyId: number | null;
  name: string;
  types: string[];
  stats: PokemonStats;
  // Highest BST reachable: for a fusion, the head's best evolution fused
  // with the body's best evolution - not a fusion of the two current forms'
  // maxima blended naively, since computeFusionStats blends individual
  // stats, not totals.
  summeMax: number;
};

export type EncounterMonDeps = {
  pokemonById: (id: number) => Pokemon | undefined;
  evolvesTo: (id: number) => number[];
  inDex: (id: number) => boolean;
  lang: Lang;
};

export function resolveEncounterMon(
  headId: number,
  bodyId: number | null | undefined,
  deps: EncounterMonDeps,
): EncounterMon | null {
  const head = deps.pokemonById(headId);
  if (!head) return null;

  const body = bodyId ? deps.pokemonById(bodyId) : undefined;
  // No donor, or the fused-in species no longer resolves (data drift) - show
  // the head alone rather than a broken card.
  if (!body) {
    return {
      headId,
      bodyId: null,
      name: displayNameWithForm(head, deps.lang),
      types: head.types,
      stats: head.stats,
      summeMax:
        bestEvolvedPokemon(headId, deps.evolvesTo, deps.pokemonById, deps.inDex)?.stats.Summe ??
        head.stats.Summe,
    };
  }

  const bestHead = bestEvolvedPokemon(headId, deps.evolvesTo, deps.pokemonById, deps.inDex) ?? head;
  const bestBody = bestEvolvedPokemon(bodyId!, deps.evolvesTo, deps.pokemonById, deps.inDex) ?? body;
  return {
    headId,
    bodyId: bodyId!,
    name: `${displayNameWithForm(head, deps.lang)} / ${displayNameWithForm(body, deps.lang)}`,
    // computeFusionTypes can yield the same type twice (see fusion.ts) - a
    // badge row or matchup must count it once.
    types: [...new Set(computeFusionTypes(head, body))],
    stats: computeFusionStats(head, body),
    summeMax: computeFusionStats(bestHead, bestBody).Summe,
  };
}
