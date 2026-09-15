import { describe, it, expect } from "vitest";
import { getEffectiveness } from "@/lib/data";
import { getTypesForGeneration, singleTypeMultiplier } from "@/lib/effectiveness";

// data/effectiveness-gen6.json exists for Infinite Fusion (no real pack here
// uses generation/dataGeneration >= 6 yet - see gameData.ts). It is
// deliberately NOT the real modern type chart: see the long comment at the
// top of that file and in getEffectiveness() for why the Steel<->Fairy cell
// in particular is a best-effort default (sourced from a wiki count of
// Steel's resistances, "11 types", which only matches if Steel does NOT
// additionally resist Fairy) pending an in-game check, rather than a
// guaranteed fact - these tests pin the current values so a correction is a
// one-line diff away.

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

  it("keeps every pre-Fairy Steel resistance untouched, Ghost and Dark included", () => {
    expect(singleTypeMultiplier(table, "ghost", "steel")).toBe(0.5);
    expect(singleTypeMultiplier(table, "dark", "steel")).toBe(0.5);
    expect(singleTypeMultiplier(table, "poison", "steel")).toBe(0);
  });

  it("does NOT give Steel a Fairy resistance - the one deliberate deviation from Gen 6+", () => {
    // Real cartridges resist here (0.5x); this pack's wiki-sourced "resistant
    // to 11 types" count for Steel only adds up without a Fairy entry.
    expect(singleTypeMultiplier(table, "fairy", "steel")).toBe(1);
  });

  it("still resists exactly 11 types plus the Poison immunity", () => {
    const resists = Object.entries(table.Stahl).filter(([, v]) => v === 0.5).length;
    const immunities = Object.entries(table.Stahl).filter(([, v]) => v === 0).length;
    expect(resists).toBe(11);
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
