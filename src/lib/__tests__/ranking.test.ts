import { describe, it, expect } from "vitest";
import { computePokemonRanks } from "@/lib/ranking";
import type { Pokemon } from "@/lib/data";

// computePokemonRanks only reads id + stats.Summe.
function mon(id: number, summe: number): Pokemon {
  return { id, stats: { Summe: summe } } as unknown as Pokemon;
}

describe("computePokemonRanks", () => {
  it("uses standard competition ranking (ties share a rank, the next value skips ahead)", () => {
    const list = [mon(1, 600), mon(2, 500), mon(3, 500), mon(4, 400)];
    const ranks = computePokemonRanks(list);
    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(2)).toBe(2);
    expect(ranks.get(3)).toBe(2); // tied with #2
    expect(ranks.get(4)).toBe(4); // skips rank 3
  });

  it("is order-independent (sorts by BST descending internally)", () => {
    const ranks = computePokemonRanks([mon(1, 400), mon(2, 600), mon(3, 500)]);
    expect(ranks.get(2)).toBe(1);
    expect(ranks.get(3)).toBe(2);
    expect(ranks.get(1)).toBe(3);
  });
});
