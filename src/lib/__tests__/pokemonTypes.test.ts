import { describe, it, expect } from "vitest";
import { typesForGeneration } from "@/lib/pokemonTypes";

describe("typesForGeneration", () => {
  it("corrects the Magnemite line to pure Electric in Gen 1 (no Steel yet)", () => {
    expect(typesForGeneration(81, ["electric", "steel"], 1)).toEqual(["electric"]);
    expect(typesForGeneration(82, ["electric", "steel"], 1)).toEqual(["electric"]);
  });

  it("keeps the stored Gen-3 typing from Gen 2 on", () => {
    expect(typesForGeneration(81, ["electric", "steel"], 3)).toEqual(["electric", "steel"]);
  });

  it("leaves other Pokémon unchanged in Gen 1", () => {
    expect(typesForGeneration(25, ["electric"], 1)).toEqual(["electric"]);
  });
});
