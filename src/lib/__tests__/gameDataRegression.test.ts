import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getPokemonById, getPokemonList, getEffectiveness, getCatchRates } from "@/lib/data";
import { singleTypeMultiplier } from "@/lib/effectiveness";

// Pins today's per-generation behaviour for the nine existing game packs, so
// the Infinite Fusion work (splitting `generation` into `generation` +
// `dataGeneration`, moving call sites onto a shared gameData helper) cannot
// silently change what a FireRed/Emerald/Black run shows. This is deliberately
// an INTEGRATION-level pin on top of data.ts/effectiveness.ts, not a duplicate
// of the lower-level unit tests in pokemonHistory.test.ts and
// catchrateHistory.test.ts - it exercises the same call shape every page uses
// (game.generation in, corrected Pokemon/effectiveness/catch-rate out).
//
// Must stay green before AND after the Infinite Fusion data-layer refactor.

const root = process.cwd();
const allGames = readdirSync(path.join(root, "data", "games"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(
    (entry) =>
      JSON.parse(
        readFileSync(path.join(root, "data", "games", entry.name, "game.json"), "utf-8"),
      ) as { id: string; generation: number; dexLimit: number },
  );
// The two Infinite Fusion packs deliberately use `generation: 5` (battle
// mechanics) with `dataGeneration: 7` (Fairy, era corrections) - see
// gameData.ts. Calling the raw generation-keyed functions below with THEIR
// `generation` on purpose asserts the pre-Infinite-Fusion behaviour that
// hasn't changed; it would give wrong answers for a pack that actually needs
// dataGeneration, so they're excluded from this file's scope on purpose (see
// infiniteFusionPacks.test.ts for their own pins).
const games = allGames.filter((g) => !g.id.startsWith("infinite-fusion"));

describe("game data regression (pre Infinite Fusion refactor)", () => {
  it("covers exactly the nine pre-Infinite-Fusion games this pins - a tenth pack changes this test's scope", () => {
    expect(games.map((g) => g.id).sort()).toEqual(
      [
        "red-blue",
        "gold-silver",
        "firered",
        "emerald",
        "platinum",
        "heartgold",
        "soulsilver",
        "black",
        "white",
      ].sort(),
    );
  });

  it("has exactly the two Infinite Fusion packs alongside them", () => {
    expect(allGames.map((g) => g.id).filter((id) => id.startsWith("infinite-fusion")).sort()).toEqual(
      ["infinite-fusion-classic", "infinite-fusion-remix"],
    );
  });

  it("never shows Fairy for Togekiss in any existing game", () => {
    for (const game of games) {
      const togekiss = getPokemonById(468, game.generation);
      expect(togekiss?.types, game.id).toEqual(["normal", "flying"]);
    }
  });

  it("keeps Heat Rotom Electric/Ghost through Gen 4 and Electric/Fire from Gen 5", () => {
    for (const game of games) {
      const heatRotom = getPokemonById(10008, game.generation);
      if (!heatRotom) continue; // forme id above the pack's dexLimit isn't relevant here
      expect(heatRotom.types, game.id).toEqual(
        game.generation >= 5 ? ["electric", "fire"] : ["electric", "ghost"],
      );
    }
  });

  it("pins the pre-ORAS Rayquaza catch rate (3, not 45) in every game this app ships", () => {
    for (const game of games) {
      const rate = getCatchRates(game.generation).find((r) => r.id === 384)?.catch_rate;
      expect(rate, game.id).toBe(3);
    }
  });

  it("filters the Pokedex list to each pack's dexLimit", () => {
    for (const game of games) {
      const list = getPokemonList(game.dexLimit, game.generation);
      expect(Math.max(...list.map((p) => p.id)), game.id).toBeLessThanOrEqual(game.dexLimit);
      expect(list.some((p) => p.id > game.dexLimit), game.id).toBe(false);
    }
  });

  it("keeps Gen 1's own type chart quirks distinct from every later game", () => {
    // Ice deals only neutral damage to Fire in Gen 1 (the resistance was added
    // later); every other pack here resists it (0.5).
    const gen1 = getEffectiveness(1);
    expect(singleTypeMultiplier(gen1, "ice", "fire")).toBe(1);
    for (const game of games.filter((g) => g.generation > 1)) {
      const table = getEffectiveness(game.generation);
      expect(singleTypeMultiplier(table, "ice", "fire"), game.id).toBe(0.5);
    }

    // The Gen 1 Ghost-vs-Psychic bug: Ghost has NO effect on Psychic. Fixed
    // from Gen 2 on (super effective, 2x).
    expect(singleTypeMultiplier(gen1, "ghost", "psychic")).toBe(0);
    for (const game of games.filter((g) => g.generation > 1)) {
      const table = getEffectiveness(game.generation);
      expect(singleTypeMultiplier(table, "ghost", "psychic"), game.id).toBe(2);
    }
  });

  it("keeps Steel resisting Ghost and Dark in every game here (the pre-Gen-6 chart)", () => {
    // Load-bearing for the Infinite Fusion effectiveness table: IF adds Fairy
    // but (per the wiki's own "resistant to 11 types" count on Steel) does NOT
    // adopt Gen 6's removal of these two resistances. Whatever table gets
    // built for that pack must extend this one, not the real modern chart.
    for (const game of games.filter((g) => g.generation > 1)) {
      const table = getEffectiveness(game.generation);
      expect(singleTypeMultiplier(table, "ghost", "steel"), game.id).toBe(0.5);
      expect(singleTypeMultiplier(table, "dark", "steel"), game.id).toBe(0.5);
    }
  });
});
