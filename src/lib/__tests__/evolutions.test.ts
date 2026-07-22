import { describe, it, expect } from "vitest";
import { maxEvolvedSumme } from "@/lib/evolutions";

// Bulbasaur(1)->Ivysaur(2)->Venusaur(3); Eevee(133) branches to 134/135/136.
const evo: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [],
  133: [134, 135, 136],
};
const summe: Record<number, number> = {
  1: 318,
  2: 405,
  3: 525,
  133: 325,
  134: 525, // Vaporeon
  135: 525, // Jolteon
  136: 525, // Flareon
};
const evolvesTo = (id: number) => evo[id] ?? [];
const summeById = (id: number) => summe[id] ?? 0;

describe("maxEvolvedSumme", () => {
  it("follows a linear chain to the final stage", () => {
    expect(maxEvolvedSumme(1, evolvesTo, summeById, 386)).toBe(525);
    expect(maxEvolvedSumme(2, evolvesTo, summeById, 386)).toBe(525);
  });

  it("returns the Pokémon's own BST when it is already the end form", () => {
    expect(maxEvolvedSumme(3, evolvesTo, summeById, 386)).toBe(525);
  });

  it("takes the strongest branch for branching evolutions", () => {
    expect(maxEvolvedSumme(133, evolvesTo, summeById, 386)).toBe(525);
  });

  it("does not cross the dex limit", () => {
    // Venusaur (id 3) excluded -> best reachable is Ivysaur (405).
    expect(maxEvolvedSumme(1, evolvesTo, summeById, 2)).toBe(405);
  });
});
