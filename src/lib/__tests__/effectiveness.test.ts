import { describe, it, expect } from "vitest";
import {
  singleTypeMultiplier,
  computeDefenseMultipliers,
  teamOffensiveCoverage,
  getTypesForGeneration,
  type EffectivenessTable,
} from "@/lib/effectiveness";

// effectiveness.json is keyed by GERMAN defender/attacker names:
// table[defender][attacker] = multiplier. Missing pairs are neutral (1).
const table: EffectivenessTable = {
  Feuer: { Wasser: 2, Boden: 2, Gestein: 2, Pflanze: 0.5, Feuer: 0.5 },
  Wasser: { Elektro: 2, Pflanze: 2, Feuer: 0.5, Wasser: 0.5 },
  Pflanze: { Feuer: 2, Wasser: 0.5, Pflanze: 0.5, Elektro: 0.5 },
  Boden: { Elektro: 0, Wasser: 2 },
};

describe("singleTypeMultiplier", () => {
  it("maps English slugs to the German-keyed table", () => {
    expect(singleTypeMultiplier(table, "water", "fire")).toBe(2); // water hits fire
    expect(singleTypeMultiplier(table, "fire", "water")).toBe(0.5);
    expect(singleTypeMultiplier(table, "electric", "ground")).toBe(0); // immunity
  });

  it("treats missing pairs as neutral", () => {
    expect(singleTypeMultiplier(table, "normal", "fire")).toBe(1);
  });
});

describe("computeDefenseMultipliers", () => {
  it("multiplies across a dual-typed defender", () => {
    // Water attacking Fire/Water: 2 * 0.5 = 1
    expect(computeDefenseMultipliers(table, ["fire", "water"], ["water"])).toEqual({ water: 1 });
  });

  it("keeps immunities at 0", () => {
    expect(computeDefenseMultipliers(table, ["ground"], ["electric"])).toEqual({ electric: 0 });
  });
});

describe("teamOffensiveCoverage", () => {
  it("reports the best multiplier per defender and the super-effective gaps", () => {
    // Team can only use Water attacks. Fire is covered (2x); water/grass aren't.
    const { best, gaps } = teamOffensiveCoverage(table, ["water"], ["fire", "water", "grass"]);
    expect(best).toEqual({ fire: 2, water: 0.5, grass: 0.5 });
    expect(gaps).toEqual(["water", "grass"]);
  });

  it("has no gaps when some attack hits a type super-effectively", () => {
    // Electric hits Water 2x -> water covered.
    const { gaps } = teamOffensiveCoverage(table, ["water", "electric"], ["fire", "water"]);
    expect(gaps).toEqual([]);
  });
});

describe("getTypesForGeneration", () => {
  it("drops Dark and Steel in Gen 1", () => {
    expect(getTypesForGeneration(1)).not.toContain("dark");
    expect(getTypesForGeneration(1)).not.toContain("steel");
  });
  it("includes Dark and Steel from Gen 2 on", () => {
    expect(getTypesForGeneration(3)).toContain("dark");
    expect(getTypesForGeneration(3)).toContain("steel");
  });
});
