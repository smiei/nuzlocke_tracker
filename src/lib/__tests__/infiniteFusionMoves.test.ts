import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getLearnset, getMoves, getMoveset, getTmCompat } from "@/lib/data";
import { attackTypesAtLevel, explosiveMove, moveListAtLevel, tmLearnMethods } from "@/lib/learnset";
import { getTypesForGeneration } from "@/lib/effectiveness";

// Infinite Fusion's move data comes from the game itself, not PokeAPI - see
// scripts/generate-infinite-fusion-moves.mjs and CLAUDE.md. These check the
// wiring and the invariants the readers depend on (every slug resolvable in
// the shared moves.json, valid type keys, TM vs tutor separated), not the
// game's individual movepools.

const VERSION_GROUP = "infinite-fusion";
const present = existsSync(path.join(process.cwd(), "data", "movesets", `${VERSION_GROUP}.json`));

describe.skipIf(!present)("Infinite Fusion move data", () => {
  const moveset = getMoveset(VERSION_GROUP);
  const learnset = getLearnset(VERSION_GROUP);
  const tmCompat = getTmCompat(VERSION_GROUP);
  const moves = getMoves("en", 7);

  it("covers the pack's species", () => {
    expect(Object.keys(moveset).length).toBeGreaterThan(400);
    expect(Object.keys(learnset).length).toBeGreaterThan(400);
    expect(Object.keys(tmCompat).length).toBeGreaterThan(100);
  });

  it("only uses move slugs the shared moves.json knows", () => {
    const unknown = new Set<string>();
    for (const list of Object.values(moveset)) {
      for (const [, slug] of list) if (!moves[slug]) unknown.add(slug);
    }
    for (const slug of Object.keys(tmCompat)) if (!moves[slug]) unknown.add(slug);
    expect([...unknown]).toEqual([]);
  });

  it("uses real type names as learnset keys", () => {
    const valid = new Set(getTypesForGeneration(7));
    const unknown = new Set<string>();
    for (const entry of Object.values(learnset)) {
      for (const type of Object.keys(entry)) if (!valid.has(type)) unknown.add(type);
    }
    expect([...unknown]).toEqual([]);
  });

  it("sorts every moveset by level and lists each move once", () => {
    for (const [id, list] of Object.entries(moveset)) {
      const levels = list.map(([level]) => level);
      expect(levels, `species ${id}`).toEqual([...levels].sort((a, b) => a - b));
      const slugs = list.map(([, slug]) => slug);
      expect(new Set(slugs).size, `species ${id}`).toBe(slugs.length);
    }
  });

  it("separates the game's TMs and HMs from tutor-only moves", () => {
    const kinds = new Set(
      Object.values(tmCompat)
        .map((entry) => entry.machine?.kind)
        .filter(Boolean),
    );
    expect(kinds.has("tm")).toBe(true);
    expect(kinds.has("hm")).toBe(true);
    // Surf is an HM in this game, so any of its learners reads as "hm".
    const surf = tmCompat["surf"];
    expect(surf?.machine?.kind).toBe("hm");
    expect(tmLearnMethods(surf, surf!.machine!.ids[0])).toContain("hm");
  });

  it("feeds the readers the UI actually calls", () => {
    // Bulbasaur: a level-1 move, a damaging type, and a localized name.
    const list = moveListAtLevel(moveset, moves, 1, 100, "en", 7, []);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].level).toBeLessThanOrEqual(5);
    expect(list[0].name).not.toBe("");
    expect(attackTypesAtLevel(learnset, 1, 100).length).toBeGreaterThan(0);
    // Electrode still goes boom - what the Kampf & Fang warning keys off.
    expect(explosiveMove(moveset, moves, 101, "en")).not.toBeNull();
  });

  it("leaves the other packs' move files alone", () => {
    const blackWhite = getMoveset("black-white");
    expect(Object.keys(blackWhite).length).toBeGreaterThan(400);
    expect(blackWhite["1"]?.some(([, slug]) => slug === "tackle")).toBe(true);
  });
});
