import { describe, it, expect } from "vitest";
import { computeCatchChance, getBallIdsForGeneration, heavyBallModifier } from "@/lib/catchrate";

describe("heavyBallModifier", () => {
  it("shifts the catch rate by weight, not by a multiplier", () => {
    expect(heavyBallModifier(6.9)).toBe(-20); // Bulbasaur
    expect(heavyBallModifier(102.3)).toBe(-20);
    expect(heavyBallModifier(102.4)).toBe(0);
    expect(heavyBallModifier(204.8)).toBe(20);
    expect(heavyBallModifier(307.2)).toBe(30);
    expect(heavyBallModifier(460)).toBe(40); // Snorlax
  });

  it("is a no-op when the weight is unknown", () => {
    expect(heavyBallModifier(undefined)).toBe(0);
  });
});

describe("Heavy Ball in the catch formula", () => {
  const base = {
    hpPercent: 100,
    level: 30,
    conditionMet: true,
    status: "none" as const,
    types: ["normal"],
    turn: 1,
  };

  it("helps a heavy target and hurts a light one", () => {
    const heavyTarget = computeCatchChance(4, { ...base, baseRate: 25, ball: "heavy", weight: 460 });
    const lightTarget = computeCatchChance(4, { ...base, baseRate: 25, ball: "heavy", weight: 6.9 });
    const plainBall = computeCatchChance(4, { ...base, baseRate: 25, ball: "poke" });
    expect(heavyTarget.chance).toBeGreaterThan(plainBall.chance);
    expect(lightTarget.chance).toBeLessThan(plainBall.chance);
  });

  it("never drops the rate below 1", () => {
    // rate 3 - 20 would go negative; the games clamp to 1.
    const r = computeCatchChance(4, { ...base, baseRate: 3, ball: "heavy", weight: 5 });
    expect(r.chance).toBeGreaterThan(0);
    expect(Number.isFinite(r.chance)).toBe(true);
  });
});

describe("ball availability per game", () => {
  it("gives HeartGold/SoulSilver the Apricorn balls and the Sport Ball", () => {
    const hgss = getBallIdsForGeneration(4, "heartgold-soulsilver");
    for (const ball of ["level", "lure", "moon", "friend", "love", "fast", "heavy", "sport"]) {
      expect(hgss).toContain(ball);
    }
  });

  it("withholds them from Diamond/Pearl/Platinum, which have no Kurt", () => {
    const dppt = getBallIdsForGeneration(4, "platinum");
    expect(dppt).not.toContain("fast");
    expect(dppt).not.toContain("heavy");
    expect(dppt).not.toContain("sport");
    expect(dppt).toContain("heal");
  });

  it("keeps the Heavy Ball available in Gen 2, where it debuted", () => {
    expect(getBallIdsForGeneration(2)).toContain("heavy");
  });
});
