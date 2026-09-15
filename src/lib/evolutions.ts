// Same traversal as maxEvolvedSumme below, but returns the best-evolved
// POKEMON rather than just its total - what Infinite Fusion's "max possible
// fusion BST" needs (see src/lib/encounterMon.ts): it fuses the head's best
// evolution with the body's best evolution, which requires each one's whole
// stat block, not only its Summe. Kept as a sibling rather than
// generalizing maxEvolvedSumme itself, since that one is already covered by
// its own tests and used exactly as-is by links/overview today.
export function bestEvolvedPokemon<T extends { id: number; stats: { Summe: number } }>(
  id: number,
  evolvesTo: (pokemonId: number) => number[],
  pokemonById: (pokemonId: number) => T | undefined,
  inDex: (pokemonId: number) => boolean,
): T | undefined {
  let best = pokemonById(id);
  const seen = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const mon = pokemonById(cur);
    if (mon && (!best || mon.stats.Summe > best.stats.Summe)) best = mon;
    for (const next of evolvesTo(cur)) {
      if (inDex(next) && !seen.has(next)) stack.push(next);
    }
  }
  return best;
}

// Highest base-stat total reachable from `id` by evolving (staying within the
// game's dex), following every branch to its strongest end form. Includes
// `id` itself, so a final-stage or non-evolving Pokémon just returns its own
// BST. Pure + injected lookups so it's trivially testable and reusable both
// server-side (links tile) and in tests.
//
// `inDex` takes a predicate rather than a raw `id <= dexLimit` number so a
// pack whose species list isn't a contiguous range (Infinite Fusion's
// allowlist, see gameData.ts's isInDex) can plug in set membership instead -
// callers pass `(id) => id <= game.dexLimit` for every other pack.
export function maxEvolvedSumme(
  id: number,
  evolvesTo: (pokemonId: number) => number[],
  summeById: (pokemonId: number) => number,
  inDex: (pokemonId: number) => boolean,
): number {
  let best = summeById(id);
  const seen = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (summeById(cur) > best) best = summeById(cur);
    for (const next of evolvesTo(cur)) {
      if (inDex(next) && !seen.has(next)) stack.push(next);
    }
  }
  return best;
}
