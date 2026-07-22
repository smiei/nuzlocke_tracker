// Highest base-stat total reachable from `id` by evolving (staying within the
// game's dexLimit), following every branch to its strongest end form. Includes
// `id` itself, so a final-stage or non-evolving Pokémon just returns its own
// BST. Pure + injected lookups so it's trivially testable and reusable both
// server-side (links tile) and in tests.
export function maxEvolvedSumme(
  id: number,
  evolvesTo: (pokemonId: number) => number[],
  summeById: (pokemonId: number) => number,
  dexLimit: number,
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
      if (next <= dexLimit && !seen.has(next)) stack.push(next);
    }
  }
  return best;
}
