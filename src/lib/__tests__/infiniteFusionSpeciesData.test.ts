import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getGameOrDefault } from "@/lib/data";
import { getCatchRatesForGame, getPokemonByIdForGame } from "@/lib/gameData";

// The Infinite Fusion packs carry the game's OWN species table (see
// scripts/generate-infinite-fusion-species.mjs and CLAUDE.md): pre-Gen-6 base
// stats for many species, Fairy typings this app's shared pokemon.json
// deliberately lacks, and custom catch rates. These pin the wiring, plus a
// few values straight out of the game's Data/species.dat.

const root = process.cwd();
const dataFile = path.join(root, "data", "shared", "infinite-fusion-species.json");
const present = existsSync(dataFile) && existsSync(path.join(root, "data", "games", "infinite-fusion-classic", "game.json"));

describe.skipIf(!present)("Infinite Fusion species data", () => {
  const game = getGameOrDefault("infinite-fusion-classic");
  const file = JSON.parse(readFileSync(dataFile, "utf-8")) as {
    sourceVersion: string;
    species: { id: number; types: string[]; stats: Record<string, number>; catchRate: number }[];
  };

  it("records which game version it came from", () => {
    expect(file.sourceVersion).toMatch(/^\d+\.\d+/);
    expect(file.species.length).toBeGreaterThan(400);
  });

  it("uses the game's pre-Gen-6 base stats", () => {
    expect(getPokemonByIdForGame(game, 12)?.stats["Sp.-A."]).toBe(80); // Butterfree, not 90
    expect(getPokemonByIdForGame(game, 15)?.stats["Ang."]).toBe(80); // Beedrill, not 90
    const pidgeot = getPokemonByIdForGame(game, 18)!;
    expect(pidgeot.stats["Init."]).toBe(91);
    expect(pidgeot.stats.Summe).toBe(
      pidgeot.stats.KP +
        pidgeot.stats["Ang."] +
        pidgeot.stats["Vert."] +
        pidgeot.stats["Sp.-A."] +
        pidgeot.stats["Sp.-V."] +
        pidgeot.stats["Init."],
    );
  });

  it("gives the species their Fairy typing, which the shared data has not", () => {
    expect(getPokemonByIdForGame(game, 35)?.types).toEqual(["fairy"]); // Clefairy
    expect(getPokemonByIdForGame(game, 183)?.types).toEqual(["water", "fairy"]); // Marill
    expect(getPokemonByIdForGame(game, 303)?.types).toEqual(["steel", "fairy"]); // Mawile
  });

  it("uses the game's own catch rates", () => {
    const rates = new Map(getCatchRatesForGame(game).map((entry) => [entry.id, entry.catch_rate]));
    expect(rates.get(81)).toBe(65); // Magnemite, not 190
    expect(rates.get(384)).toBe(3); // Rayquaza, not the ORAS-era 45
    expect(rates.get(663)).toBe(255); // Talonflame
  });

  it("leaves every other pack on the shared data", () => {
    const firered = getGameOrDefault("firered");
    expect(firered.speciesData).toBeUndefined();
    // Types and catch rates, not base stats: a Gen 1-5 pack rolls the Gen 6
    // stat buffs back anyway (pokemon-history), so Butterfree reads 80 Sp.Atk
    // there for its own reason and would prove nothing about leaking.
    expect(getPokemonByIdForGame(firered, 35)?.types).toEqual(["normal"]); // Clefairy, pre-Fairy
    expect(getPokemonByIdForGame(firered, 303)?.types).toEqual(["steel"]); // Mawile, pre-Fairy
    const rates = new Map(getCatchRatesForGame(firered).map((e) => [e.id, e.catch_rate]));
    expect(rates.get(81)).toBe(190); // Magnemite keeps the real games' rate
    expect(rates.get(663)).toBe(45); // Talonflame, not the game's 255
  });
});
