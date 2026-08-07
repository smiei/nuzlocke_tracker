import type { Pokemon } from "@/lib/data";

// Standard competition ("1224") ranking by total stats (Summe): ties share
// the same rank, and the next distinct value skips ahead by the number of
// tied entries (e.g. four-way tie for rank 1 -> the next Pokemon is rank 5).
export function computePokemonRanks(pokemonList: Pokemon[]): Map<number, number> {
  const sorted = [...pokemonList].sort((a, b) => b.stats.Summe - a.stats.Summe);
  const ranks = new Map<number, number>();
  let lastSumme: number | null = null;
  let lastRank = 0;
  sorted.forEach((p, index) => {
    if (p.stats.Summe !== lastSumme) {
      lastRank = index + 1;
      lastSumme = p.stats.Summe;
    }
    ranks.set(p.id, lastRank);
  });
  return ranks;
}

// Where a BST would place in the ranked list WITHOUT joining it - used for
// alternate formes, which are ranked against the species (a 520-BST Wash
// Rotom shouldn't read as rank 0, but adding the 15 formes to the pool would
// shift every species' rank and disagree with the Pokédex tab). Same
// competition rule: 1 + however many entries beat it.
export function rankForSumme(pokemonList: Pokemon[], summe: number): number {
  return pokemonList.filter((p) => p.stats.Summe > summe).length + 1;
}
