import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  getPokemonListForGame,
  getPokemonByIdForGame,
  getPokemonFormsForGame,
  getEffectivenessForGame,
  getCatchRatesForGame,
  getMovesForGame,
  getAttackTypesForGame,
  isInDex,
} from "@/lib/gameData";
import {
  getPokemonList,
  getPokemonById,
  getPokemonForms,
  getEffectiveness,
  getCatchRates,
  getMoves,
  type GameInfo,
} from "@/lib/data";
import { getTypesForGeneration } from "@/lib/effectiveness";

// Real FireRed game.json fields, none of the new Infinite Fusion flags set.
const fireRed: GameInfo = {
  id: "firered",
  sort: 1,
  generation: 3,
  dexLimit: 386,
  spriteSet: "emerald",
  versionGroup: "firered-leafgreen",
  names: { de: "x", en: "x" },
};

describe("gameData: every existing pack is byte-for-byte the old direct call", () => {
  it("getPokemonListForGame", () => {
    expect(getPokemonListForGame(fireRed)).toEqual(
      getPokemonList(fireRed.dexLimit, fireRed.generation),
    );
  });

  it("getPokemonByIdForGame", () => {
    expect(getPokemonByIdForGame(fireRed, 468)).toEqual(
      getPokemonById(468, fireRed.generation),
    );
  });

  it("getPokemonFormsForGame", () => {
    expect(getPokemonFormsForGame(fireRed)).toEqual(
      getPokemonForms(fireRed.dexLimit, fireRed.generation),
    );
  });

  it("getEffectivenessForGame", () => {
    expect(getEffectivenessForGame(fireRed)).toEqual(getEffectiveness(fireRed.generation));
  });

  it("getCatchRatesForGame", () => {
    expect(getCatchRatesForGame(fireRed)).toEqual(getCatchRates(fireRed.generation));
  });

  it("getMovesForGame", () => {
    expect(getMovesForGame(fireRed, "de")).toEqual(getMoves("de", fireRed.generation));
  });

  it("getAttackTypesForGame", () => {
    expect(getAttackTypesForGame(fireRed)).toEqual(getTypesForGeneration(fireRed.generation));
  });

  it("isInDex mirrors the plain id <= dexLimit check", () => {
    expect(isInDex(fireRed, 386)).toBe(true);
    expect(isInDex(fireRed, 387)).toBe(false);
  });
});

describe("gameData: dataGeneration overrides generation for era-sensitive data only", () => {
  const gen1WithModernData: GameInfo = { ...fireRed, generation: 1, dataGeneration: 3 };

  it("getEffectivenessForGame follows dataGeneration, not generation", () => {
    // generation: 1 alone would select effectiveness-gen1.json (no Steel/Dark,
    // the Ghost-vs-Psychic bug); dataGeneration: 3 must override that.
    const table = getEffectivenessForGame(gen1WithModernData);
    expect(table).toEqual(getEffectiveness(3));
    expect(table).not.toEqual(getEffectiveness(1));
  });

  it("getPokemonByIdForGame follows dataGeneration for era corrections", () => {
    expect(getPokemonByIdForGame(gen1WithModernData, 468)).toEqual(getPokemonById(468, 3));
  });

  it("a game without dataGeneration still falls back to generation", () => {
    expect(getEffectivenessForGame(fireRed)).toEqual(getEffectiveness(fireRed.generation));
  });
});

describe("gameData: nameLang forces every language key to one string", () => {
  const englishOnly: GameInfo = { ...fireRed, nameLang: "en" };

  it("getPokemonByIdForGame", () => {
    const bulbasaur = getPokemonByIdForGame(englishOnly, 1);
    expect(bulbasaur?.names.en).toBe("Bulbasaur");
    // The German UI must still see "Bulbasaur", not "Bisasam".
    expect(bulbasaur?.names.de).toBe("Bulbasaur");
    expect(bulbasaur?.names.fr).toBe("Bulbasaur");
  });

  it("getPokemonListForGame applies it to every entry", () => {
    const list = getPokemonListForGame(englishOnly);
    const bulbasaur = list.find((p) => p.id === 1);
    expect(bulbasaur?.names.de).toBe(bulbasaur?.names.en);
  });

  it("leaves names alone when nameLang is unset", () => {
    const bisasam = getPokemonByIdForGame(fireRed, 1);
    expect(bisasam?.names.de).toBe("Bisasam");
  });
});

describe("gameData: species allowlist (Infinite Fusion)", () => {
  // The real pack, not a fixture - see scripts/generate-infinite-fusion-packs.mjs.
  // getGames() enumerates every folder under data/games/, so a throwaway
  // fixture pack here would leak into the real game picker; this is exactly
  // why the allowlist branch had no test until this pack existed.
  const infiniteFusion: GameInfo = {
    id: "infinite-fusion-classic",
    sort: 10,
    generation: 5,
    dataGeneration: 7,
    species: true,
    nameLang: "en",
    dexLimit: 800,
    spriteSet: "black-white",
    versionGroup: "infinite-fusion",
    names: { de: "x", en: "x" },
  };

  it("filters the pick list to exactly the 572 species in species.json, not a dexLimit ceiling", () => {
    const list = getPokemonListForGame(infiniteFusion);
    expect(list).toHaveLength(572);
  });

  it("includes a forme id used by this pack's species.json (Oricorio Pom-Pom, 10123)", () => {
    const list = getPokemonListForGame(infiniteFusion);
    expect(list.some((p) => p.id === 10123)).toBe(true);
  });

  it("agrees exactly with species.json's allowlist, not a dexLimit-style ceiling", () => {
    const list = getPokemonListForGame(infiniteFusion);
    const speciesJson = readFileSync(
      path.join(process.cwd(), "data/games/infinite-fusion-classic/species.json"),
      "utf-8",
    );
    const allowed = new Set(
      (JSON.parse(speciesJson) as { ourId: number }[]).map((e) => e.ourId),
    );
    expect(new Set(list.map((p) => p.id))).toEqual(allowed);
  });

  it("isInDex matches the same allowlist, not id <= dexLimit", () => {
    expect(isInDex(infiniteFusion, 720)).toBe(false); // within dexLimit (800) but not in the 572-species allowlist
    expect(isInDex(infiniteFusion, 10123)).toBe(true); // Oricorio Pom-Pom forme, above every dexLimit ever used
  });

  it("forces English names through the allowlist path too", () => {
    const list = getPokemonListForGame(infiniteFusion);
    const bulbasaur = list.find((p) => p.id === 1);
    expect(bulbasaur?.names.de).toBe("Bulbasaur");
  });
});
