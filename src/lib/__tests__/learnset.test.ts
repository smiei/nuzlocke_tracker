import { describe, it, expect } from "vitest";
import {
  attackTypesAtLevel,
  damageClassForGeneration,
  moveListAtLevel,
  moveStatsForGeneration,
  explosiveMove,
  tmLearnMethods,
  historicalMoveType,
  type Learnset,
  type MoveInfo,
  type Moveset,
  type MovesTable,
  type MoveTypeHistoryEntry,
  type TmCompatEntry,
} from "@/lib/learnset";

const learnset: Learnset = {
  "1": { normal: 1, grass: 7 },
};

const moveset: Moveset = {
  "1": [
    [1, "tackle"],
    [7, "vine-whip"],
    [20, "razor-leaf"],
  ],
  "100": [
    [1, "tackle"],
    [27, "self-destruct"],
    [46, "explosion"],
  ],
};

const moves: MovesTable = {
  tackle: { type: "normal", damaging: true, names: { en: "Tackle" } },
  "vine-whip": { type: "grass", damaging: true, names: { en: "Vine Whip" } },
  "razor-leaf": { type: "grass", damaging: true, names: { en: "Razor Leaf" } },
  "self-destruct": { type: "normal", damaging: true, names: { en: "Self-Destruct" } },
  explosion: { type: "normal", damaging: true, names: { en: "Explosion" } },
};

describe("attackTypesAtLevel", () => {
  it("only counts damaging types reachable by the given level, sorted by level", () => {
    expect(attackTypesAtLevel(learnset, 1, 6)).toEqual([{ type: "normal", level: 1 }]);
    expect(attackTypesAtLevel(learnset, 1, 7)).toEqual([
      { type: "normal", level: 1 },
      { type: "grass", level: 7 },
    ]);
  });

  it("returns [] for an unknown Pokémon", () => {
    expect(attackTypesAtLevel(learnset, 999, 100)).toEqual([]);
  });
});

describe("moveListAtLevel", () => {
  it("localizes and filters level-up moves up to the level", () => {
    const list = moveListAtLevel(moveset, moves, 1, 10, "en", 4, []);
    expect(list.map((m) => `${m.level}:${m.name}`)).toEqual(["1:Tackle", "7:Vine Whip"]);
  });

  it("applies a historical type override when one is given", () => {
    const history: MoveTypeHistoryEntry[] = [
      { slug: "vine-whip", type: "normal", maxGeneration: 1 },
    ];
    // Gen 4: override doesn't apply (maxGeneration 1) -> current data type.
    expect(moveListAtLevel(moveset, moves, 1, 10, "en", 4, history).find((m) => m.name === "Vine Whip")?.type).toBe("grass");
    // Gen 1: override applies.
    expect(moveListAtLevel(moveset, moves, 1, 10, "en", 1, history).find((m) => m.name === "Vine Whip")?.type).toBe("normal");
  });
});

describe("damageClassForGeneration", () => {
  it("uses the move's own class from Gen 4 on", () => {
    expect(damageClassForGeneration(4, "dark", "physical")).toBe("physical");
    expect(damageClassForGeneration(9, "ghost", "special")).toBe("special");
  });

  it("derives the class from the TYPE before the Gen 4 split", () => {
    // Bite/Crunch are Dark -> special in Gen 3, physical from Gen 4.
    expect(damageClassForGeneration(3, "dark", "physical")).toBe("special");
    // Gust/Shadow Ball are Flying/Ghost -> physical in Gen 3, special later.
    expect(damageClassForGeneration(3, "flying", "special")).toBe("physical");
    expect(damageClassForGeneration(3, "ghost", "special")).toBe("physical");
    // Unchanged either way.
    expect(damageClassForGeneration(3, "water", "special")).toBe("special");
    expect(damageClassForGeneration(3, "ground", "physical")).toBe("physical");
  });

  it("keeps status moves as status in every generation", () => {
    expect(damageClassForGeneration(1, "normal", "status", false)).toBe("status");
    expect(damageClassForGeneration(4, "normal", "status", false)).toBe("status");
    // A damaging=false move with no recorded class still reads as status.
    expect(damageClassForGeneration(3, "normal", undefined, false)).toBe("status");
  });
});

describe("moveStatsForGeneration", () => {
  // Thunderbolt: 95 power through Gen 5, 90 from Gen 6.
  const thunderbolt: MoveInfo = {
    type: "electric",
    damaging: true,
    names: { en: "Thunderbolt" },
    power: 90,
    accuracy: 100,
    pp: 15,
    effectChance: 10,
    past: [{ maxGeneration: 5, power: 95 }],
  };
  // Tackle: 35/95 through Gen 4, 50 power through Gen 6, 40/100 today.
  const tackle: MoveInfo = {
    type: "normal",
    damaging: true,
    names: { en: "Tackle" },
    power: 40,
    accuracy: 100,
    pp: 35,
    effectChance: null,
    past: [
      { maxGeneration: 4, power: 35, accuracy: 95 },
      { maxGeneration: 6, power: 50 },
    ],
  };

  it("returns the value in effect for that generation", () => {
    expect(moveStatsForGeneration(thunderbolt, 3).power).toBe(95);
    expect(moveStatsForGeneration(thunderbolt, 5).power).toBe(95);
    expect(moveStatsForGeneration(thunderbolt, 6).power).toBe(90);
  });

  it("resolves each field independently across past entries", () => {
    expect(moveStatsForGeneration(tackle, 3)).toMatchObject({ power: 35, accuracy: 95 });
    // Gen 5: power comes from the later entry, accuracy already fell through
    // to the current value (the Gen-6 entry doesn't record one).
    expect(moveStatsForGeneration(tackle, 5)).toMatchObject({ power: 50, accuracy: 100 });
    expect(moveStatsForGeneration(tackle, 9)).toMatchObject({ power: 40, accuracy: 100 });
  });

  it("falls back to the current values when there is no history", () => {
    const info: MoveInfo = {
      type: "normal",
      damaging: true,
      names: { en: "X" },
      power: 60,
      accuracy: 85,
      pp: 20,
      effectChance: null,
    };
    expect(moveStatsForGeneration(info, 1)).toEqual({
      power: 60,
      accuracy: 85,
      pp: 20,
      effectChance: null,
    });
  });

  it("reports nulls for a move with no recorded stats at all", () => {
    const bare: MoveInfo = { type: "normal", damaging: true, names: { en: "X" } };
    expect(moveStatsForGeneration(bare, 3)).toEqual({
      power: null,
      accuracy: null,
      pp: null,
      effectChance: null,
    });
  });
});

describe("moveListAtLevel move details", () => {
  const detailed: MovesTable = {
    bite: {
      type: "dark",
      damaging: true,
      names: { en: "Bite" },
      damageClass: "physical",
      power: 60,
      accuracy: 100,
      pp: 25,
      effectChance: 30,
      flavor: "Bites the target.",
    },
  };
  const set: Moveset = { "1": [[1, "bite"]] };

  it("carries gen-accurate stats, class and flavor onto the entry", () => {
    const [gen3] = moveListAtLevel(set, detailed, 1, 100, "en", 3, []);
    expect(gen3).toMatchObject({
      name: "Bite",
      damageClass: "special", // Dark is special pre-split
      power: 60,
      pp: 25,
      effectChance: 30,
      flavor: "Bites the target.",
    });
    // The modern class differs, so the hint field is populated.
    expect(gen3.modernDamageClass).toBe("physical");
    // Power never changed, so no hint.
    expect(gen3.modernPower).toBeUndefined();
  });

  it("omits the hint fields entirely when nothing differs", () => {
    const [gen4] = moveListAtLevel(set, detailed, 1, 100, "en", 4, []);
    expect(gen4.damageClass).toBe("physical");
    expect(gen4.modernDamageClass).toBeUndefined();
    expect(gen4.modernAccuracy).toBeUndefined();
  });
});

describe("historicalMoveType", () => {
  const history: MoveTypeHistoryEntry[] = [
    { slug: "bite", type: "normal", maxGeneration: 2 },
    { slug: "charm", type: "normal", maxGeneration: 5 },
  ];
  it("returns the historical type when the generation is covered", () => {
    expect(historicalMoveType(history, "bite", 1, "dark")).toBe("normal");
    expect(historicalMoveType(history, "bite", 2, "dark")).toBe("normal");
    expect(historicalMoveType(history, "charm", 4, "fairy")).toBe("normal");
  });
  it("falls back to the current type once the generation is past maxGeneration", () => {
    expect(historicalMoveType(history, "bite", 3, "dark")).toBe("dark");
  });
  it("falls back to the current type for moves with no history entry", () => {
    expect(historicalMoveType(history, "tackle", 1, "normal")).toBe("normal");
  });
});

describe("explosiveMove", () => {
  it("finds the lowest-level self-destruct/explosion move", () => {
    expect(explosiveMove(moveset, moves, 100, "en")).toEqual({
      slug: "self-destruct",
      level: 27,
      name: "Self-Destruct",
    });
  });
  it("returns null when the Pokémon can't self-destruct", () => {
    expect(explosiveMove(moveset, moves, 1, "en")).toBeNull();
  });
});

describe("tmLearnMethods", () => {
  const entry: TmCompatEntry = { machine: { kind: "hm", ids: [7, 9] }, tutor: [9, 130] };
  it("reports how a Pokémon can learn a move", () => {
    expect(tmLearnMethods(entry, 7)).toEqual(["hm"]);
    expect(tmLearnMethods(entry, 9)).toEqual(["hm", "tutor"]);
    expect(tmLearnMethods(entry, 130)).toEqual(["tutor"]);
    expect(tmLearnMethods(entry, 1)).toEqual([]);
    expect(tmLearnMethods(undefined, 7)).toEqual([]);
  });
});
