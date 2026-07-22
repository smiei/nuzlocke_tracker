import { describe, it, expect } from "vitest";
import {
  attackTypesAtLevel,
  moveListAtLevel,
  explosiveMove,
  tmLearnMethods,
  type Learnset,
  type Moveset,
  type MovesTable,
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
    const list = moveListAtLevel(moveset, moves, 1, 10, "en");
    expect(list.map((m) => `${m.level}:${m.name}`)).toEqual(["1:Tackle", "7:Vine Whip"]);
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
