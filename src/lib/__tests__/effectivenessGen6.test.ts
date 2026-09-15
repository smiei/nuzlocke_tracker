import { describe, it, expect } from "vitest";
import { getEffectiveness } from "@/lib/data";
import { getTypesForGeneration, singleTypeMultiplier } from "@/lib/effectiveness";

// data/effectiveness-gen6.json exists for Infinite Fusion (no other pack here
// uses generation/dataGeneration >= 6 - see gameData.ts). Its 18x18 chart was
// verified cell by cell against the game's own Data/types.dat (version 6.2.4
// of github.com/infinitefusion/infinitefusion-e18): exactly three cells
// differed from the first, wiki-derived version of this file and were
// corrected, so the table is now the real modern Gen 6+ chart.

describe("effectiveness-gen6.json (Fairy added to the pre-Fairy chart)", () => {
  const table = getEffectiveness(6);

  it("gives Fairy its standard real-game attacking profile", () => {
    expect(singleTypeMultiplier(table, "fairy", "fighting")).toBe(2);
    expect(singleTypeMultiplier(table, "fairy", "dragon")).toBe(2);
    expect(singleTypeMultiplier(table, "fairy", "dark")).toBe(2);
    expect(singleTypeMultiplier(table, "fairy", "fire")).toBe(0.5);
    expect(singleTypeMultiplier(table, "fairy", "poison")).toBe(0.5);
    expect(singleTypeMultiplier(table, "fairy", "normal")).toBe(1);
  });

  it("gives Fairy its standard real-game defensive profile", () => {
    expect(singleTypeMultiplier(table, "poison", "fairy")).toBe(2);
    expect(singleTypeMultiplier(table, "steel", "fairy")).toBe(2);
    expect(singleTypeMultiplier(table, "fighting", "fairy")).toBe(0.5);
    expect(singleTypeMultiplier(table, "bug", "fairy")).toBe(0.5);
    expect(singleTypeMultiplier(table, "dark", "fairy")).toBe(0.5);
    expect(singleTypeMultiplier(table, "dragon", "fairy")).toBe(0);
  });

  it("drops Steel's Ghost and Dark resistances, exactly like the game's types.dat", () => {
    expect(singleTypeMultiplier(table, "ghost", "steel")).toBe(1);
    expect(singleTypeMultiplier(table, "dark", "steel")).toBe(1);
    expect(singleTypeMultiplier(table, "poison", "steel")).toBe(0);
  });

  it("gives Steel its Fairy resistance", () => {
    expect(singleTypeMultiplier(table, "fairy", "steel")).toBe(0.5);
  });

  it("resists exactly 10 types plus the Poison immunity", () => {
    // The wiki's "Steel resists 11 types" counts the Poison immunity as one.
    const resists = Object.entries(table.Stahl).filter(([, v]) => v === 0.5).length;
    const immunities = Object.entries(table.Stahl).filter(([, v]) => v === 0).length;
    expect(resists).toBe(10);
    expect(immunities).toBe(1);
  });
});

describe("getTypesForGeneration(6+)", () => {
  it("adds Fairy to the Gen 2-5 type list", () => {
    expect(getTypesForGeneration(6)).toContain("fairy");
    expect(getTypesForGeneration(6)).toContain("dark");
    expect(getTypesForGeneration(6)).toContain("steel");
  });

  it("leaves generations before 6 without Fairy", () => {
    expect(getTypesForGeneration(5)).not.toContain("fairy");
  });
});
