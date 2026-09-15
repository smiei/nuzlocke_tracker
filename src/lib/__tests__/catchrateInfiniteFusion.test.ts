import { describe, it, expect } from "vitest";
import {
  ballHasCondition,
  computeCatchChance,
  getBallIdsForGeneration,
  heavyBallModifierInfiniteFusion,
  INFINITE_FUSION_VERSION_GROUP as IF,
  type CatchInput,
} from "@/lib/catchrate";

// Reference values were re-derived independently from pbCaptureCalc in
// infinitefusion-e18 (011_Battle/003_Battle/001_PokeBattle_BattleCommon.rb):
// x = floor(rate * (3 - 2 * hp) / 3 * status), y = floor(65536 / (255 / x)^0.1875),
// chance = (y / 65536)^4.
const base: CatchInput = {
  baseRate: 45,
  hpPercent: 100,
  level: 50,
  ball: "poke",
  status: "none",
  types: ["normal"],
  turn: 1,
};
const throwBall = (patch: Partial<CatchInput>) => computeCatchChance(5, { ...base, ...patch }, IF);

describe("Infinite Fusion ball list", () => {
  it("has the game's 40 throwable balls, each once", () => {
    const balls = getBallIdsForGeneration(5, IF);
    expect(balls).toHaveLength(40);
    expect(new Set(balls).size).toBe(40);
    expect(balls).toEqual(
      expect.arrayContaining(["cherish", "fusion", "boost", "glitter", "status", "pure", "sport", "safari"]),
    );
    expect(balls).not.toContain("park");
  });

  it("leaves every other game's list alone", () => {
    expect(getBallIdsForGeneration(5)).not.toContain("cherish");
    expect(getBallIdsForGeneration(5, "black-white")).toHaveLength(15);
  });

  it("works the Fast Ball out from base Speed instead of asking", () => {
    expect(ballHasCondition("fast", IF)).toBe(false);
    expect(ballHasCondition("fast")).toBe(true);
    expect(ballHasCondition("dusk", IF)).toBe(true);
  });
});

describe("Infinite Fusion capture formula", () => {
  it("makes four shake checks, not Gen 5's three", () => {
    expect(throwBall({}).chance).toBeCloseTo(0.1194376, 6);
    expect(computeCatchChance(5, base).chance).toBeCloseTo(0.2031682, 6);
  });

  it("guarantees the Master Ball and applies the sleep bonus", () => {
    expect(throwBall({ ball: "master", baseRate: 3 }).guaranteed).toBe(true);
    expect(throwBall({ ball: "ultra", hpPercent: 1, status: "sleep" }).chance).toBeCloseTo(0.9042764, 6);
  });

  it("status-inflicting balls earn the bonus of the status they cause", () => {
    const frost = throwBall({ ball: "frost" });
    expect(frost.statusText).toBe("×2.5");
    expect(frost.chance).toBeCloseTo(0.2350901, 6);
    expect(throwBall({ ball: "toxic" }).statusText).toBe("×1.5");
    const dream = throwBall({ ball: "dream" });
    expect(dream.guaranteed).toBe(false);
    expect(dream.statusText).toBe("×2.5");
  });

  it("behaves like the game's code for the Pure and Status Balls", () => {
    // Status Ball: floor(45 * 5 / 2) = 112 even without any status.
    expect(throwBall({ ball: "status" }).chance).toBeCloseTo(0.2350901, 6);
    expect(throwBall({ ball: "pure" }).chance).toBe(throwBall({}).chance);
  });

  it("gives the Fusion Ball ×3 against fusions only", () => {
    expect(throwBall({ ball: "fusion", isFusion: true }).chance).toBeCloseTo(0.2722659, 6);
    expect(throwBall({ ball: "fusion" }).chance).toBe(throwBall({}).chance);
  });

  it("uses base Speed for the Fast Ball", () => {
    expect(throwBall({ ball: "fast", baseSpeed: 100 }).ballText).toBe("×4");
    expect(throwBall({ ball: "fast", baseSpeed: 99 }).ballText).toBe("×1");
  });

  it("scales the Timer, Quick and Nest Balls the game's way", () => {
    expect(throwBall({ ball: "timer", turn: 1 }).ballText).toBe("×1");
    expect(throwBall({ ball: "timer", turn: 5 }).ballText).toBe("×2.2");
    expect(throwBall({ ball: "timer", turn: 30 }).ballText).toBe("×4");
    expect(throwBall({ ball: "quick", turn: 1 }).ballText).toBe("×5");
    expect(throwBall({ ball: "quick", turn: 2 }).ballText).toBe("×1");
    expect(throwBall({ ball: "nest", level: 1 }).ballText).toBe("×4");
    expect(throwBall({ ball: "nest", level: 30 }).ballText).toBe("×1.1");
    expect(throwBall({ ball: "nest", level: 31 }).ballText).toBe("×1");
  });

  it("uses the old Heavy Ball brackets, with no neutral step", () => {
    expect(heavyBallModifierInfiniteFusion(204.7)).toBe(-20);
    expect(heavyBallModifierInfiniteFusion(204.8)).toBe(20);
    expect(heavyBallModifierInfiniteFusion(307.2)).toBe(30);
    expect(heavyBallModifierInfiniteFusion(409.6)).toBe(40);
    expect(throwBall({ ball: "heavy", baseRate: 3, weight: 250 }).chance).toBeCloseTo(0.0674388, 6);
    expect(throwBall({ ball: "heavy", baseRate: 3, weight: 10 }).chance).toBeCloseTo(0.0156696, 6);
  });

  it("lowers the rate for the game's own utility balls", () => {
    expect(throwBall({ ball: "ability" }).chance).toBe(throwBall({ baseRate: 27 }).chance);
  });

  it("drops a conditional ball's bonus when its condition is unticked", () => {
    expect(throwBall({ ball: "dusk", conditionMet: false }).chance).toBe(throwBall({}).chance);
    expect(throwBall({ ball: "dusk" }).ballText).toBe("×3.5");
  });
});
