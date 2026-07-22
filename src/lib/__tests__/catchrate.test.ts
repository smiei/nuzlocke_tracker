import { describe, it, expect } from "vitest";
import {
  computeCatchChance,
  ballHasCondition,
  getBallIdsForGeneration,
  type CatchInput,
} from "@/lib/catchrate";

const base: Omit<CatchInput, "ball"> = {
  baseRate: 45,
  hpPercent: 100,
  level: 50,
  status: "none",
  types: [],
  turn: 1,
};

describe("computeCatchChance", () => {
  it("Gen 3/4 conditional ball counts only when the condition is met", () => {
    expect(
      computeCatchChance(3, { ...base, ball: "repeat", conditionMet: true }).ballText,
    ).toBe("×3");
    expect(
      computeCatchChance(3, { ...base, ball: "repeat", conditionMet: false }).ballText,
    ).toBe("×1");
  });

  it("Master Ball is a guaranteed catch in every generation", () => {
    for (const gen of [1, 2, 3, 4]) {
      const r = computeCatchChance(gen, { ...base, ball: "master" });
      expect(r.guaranteed).toBe(true);
      expect(r.chance).toBe(1);
    }
  });

  it("Gen 3/4 guarantees the catch once the shake value a >= 255", () => {
    const r = computeCatchChance(3, {
      ...base,
      baseRate: 200,
      hpPercent: 1,
      ball: "ultra",
    });
    expect(r.guaranteed).toBe(true);
  });

  it("returns a proper 0..1 probability for a normal throw", () => {
    const r = computeCatchChance(3, { ...base, ball: "poke" });
    expect(r.guaranteed).toBe(false);
    expect(r.chance).toBeGreaterThan(0);
    expect(r.chance).toBeLessThan(1);
  });

  it("net ball is x3 against water/bug, x1 otherwise (Gen 3/4)", () => {
    expect(computeCatchChance(3, { ...base, ball: "net", types: ["water"] }).ballText).toBe("×3");
    expect(computeCatchChance(3, { ...base, ball: "net", types: ["fire"] }).ballText).toBe("×1");
  });
});

describe("ballHasCondition / getBallIdsForGeneration", () => {
  it("flags situational balls", () => {
    expect(ballHasCondition("repeat")).toBe(true);
    expect(ballHasCondition("dusk")).toBe(true);
    expect(ballHasCondition("poke")).toBe(false);
  });

  it("returns the era-appropriate ball list", () => {
    expect(getBallIdsForGeneration(1)).toContain("safari");
    expect(getBallIdsForGeneration(1)).not.toContain("repeat");
    expect(getBallIdsForGeneration(4)).toEqual(expect.arrayContaining(["quick", "dusk"]));
    expect(getBallIdsForGeneration(3)).not.toContain("quick");
  });
});
