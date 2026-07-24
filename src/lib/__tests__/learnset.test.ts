import { describe, it, expect } from "vitest";
import {
  attackTypesAtLevel,
  moveListAtLevel,
  explosiveMove,
  tmLearnMethods,
  historicalMoveType,
  type Learnset,
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
