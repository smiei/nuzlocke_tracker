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
