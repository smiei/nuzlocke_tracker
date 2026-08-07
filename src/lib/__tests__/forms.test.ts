import { describe, it, expect } from "vitest";
import type { Pokemon } from "@/lib/data";
import {
  baseSpeciesId,
  displayNameWithForm,
  formLabel,
  formsOfSpecies,
  isForm,
  movepoolId,
} from "@/lib/forms";
import { rankForSumme } from "@/lib/ranking";

const stats = (summe: number) => ({
  KP: 0,
  "Ang.": 0,
  "Vert.": 0,
  "Sp.-A.": 0,
  "Sp.-V.": 0,
  "Init.": 0,
  Summe: summe,
});

const rotom: Pokemon = {
  id: 479,
  names: { de: "Rotom", en: "Rotom" },
  types: ["electric", "ghost"],
  family_id: 479,
  stats: stats(440),
  legendary: false,
  formNames: { de: "Rotom", en: "Rotom" },
};
const rotomWash: Pokemon = {
  id: 10009,
  names: { de: "Rotom", en: "Rotom" },
  types: ["electric", "water"],
  family_id: 479,
  stats: stats(520),
  legendary: false,
  baseId: 479,
  formNames: { de: "Wasch-Rotom", en: "Wash Rotom" },
};
const deoxys: Pokemon = {
  id: 386,
  names: { de: "Deoxys", en: "Deoxys" },
  types: ["psychic"],
  family_id: 386,
  stats: stats(600),
  legendary: true,
  formNames: { de: "Normalform", en: "Normal Forme" },
};
const deoxysAttack: Pokemon = {
  id: 10001,
  names: { de: "Deoxys", en: "Deoxys" },
  types: ["psychic"],
  family_id: 386,
  stats: stats(600),
  legendary: true,
  baseId: 386,
  formNames: { de: "Angriffsform", en: "Attack Forme" },
};
const pikachu: Pokemon = {
  id: 25,
  names: { de: "Pikachu", en: "Pikachu" },
  types: ["electric"],
  family_id: 172,
  stats: stats(320),
  legendary: false,
};

const pokemonList = [pikachu, deoxys, rotom];
const forms = [deoxysAttack, rotomWash];

describe("isForm / baseSpeciesId", () => {
  it("distinguishes formes from base species", () => {
    expect(isForm(rotomWash)).toBe(true);
    expect(isForm(rotom)).toBe(false);
    expect(isForm(pikachu)).toBe(false);
  });

  it("normalizes any entry to its species id", () => {
    expect(baseSpeciesId(rotomWash)).toBe(479);
    expect(baseSpeciesId(rotom)).toBe(479);
    expect(baseSpeciesId(pikachu)).toBe(25);
  });
});

describe("formsOfSpecies", () => {
  it("lists the base first, then its alternates by id", () => {
    expect(formsOfSpecies(386, pokemonList, forms).map((p) => p.id)).toEqual([386, 10001]);
    expect(formsOfSpecies(479, pokemonList, forms).map((p) => p.id)).toEqual([479, 10009]);
  });

  it("returns nothing for a species without alternates, so the picker hides", () => {
    expect(formsOfSpecies(25, pokemonList, forms)).toEqual([]);
  });
});

describe("formLabel / displayNameWithForm", () => {
  it("labels each entry by its forme name", () => {
    expect(formLabel(deoxysAttack, "de")).toBe("Angriffsform");
    expect(formLabel(deoxys, "de")).toBe("Normalform");
    // No forme name recorded -> the species name stands in.
    expect(formLabel(pikachu, "de")).toBe("Pikachu");
  });

  it("qualifies a forme's display name but leaves base species alone", () => {
    expect(displayNameWithForm(deoxysAttack, "de")).toBe("Deoxys (Angriffsform)");
    expect(displayNameWithForm(deoxys, "de")).toBe("Deoxys");
    expect(displayNameWithForm(pikachu, "de")).toBe("Pikachu");
  });

  it("does not repeat the species name when the forme already carries it", () => {
    // "Rotom (Wasch-Rotom)" would read badly.
    expect(displayNameWithForm(rotomWash, "de")).toBe("Wasch-Rotom");
  });
});

describe("movepoolId", () => {
  it("prefers the forme's own movepool when it has one", () => {
    // Deoxys Attack genuinely learns different moves than Normal.
    const has = (id: number) => id === 10001 || id === 386;
    expect(movepoolId(deoxysAttack, has)).toBe(10001);
  });

  it("falls back to the species when the forme has no rows", () => {
    // Wash Rotom shares Rotom's movepool, so no forme rows exist for it - and
    // the same happens for a forme absent from a given game (Gen 3 tagged
    // Deoxys Speed to Emerald only, so it has none under FireRed).
    const has = (id: number) => id === 479;
    expect(movepoolId(rotomWash, has)).toBe(479);
    expect(movepoolId(deoxysAttack, (id) => id === 386)).toBe(386);
  });

  it("leaves plain species untouched", () => {
    expect(movepoolId(pikachu, () => true)).toBe(25);
    expect(movepoolId(pikachu, () => false)).toBe(25);
  });
});

describe("rankForSumme", () => {
  it("ranks a value against the pool without joining it", () => {
    // Pool BSTs: 600, 440, 320.
    expect(rankForSumme(pokemonList, 520)).toBe(2); // only Deoxys beats it
    expect(rankForSumme(pokemonList, 700)).toBe(1);
    expect(rankForSumme(pokemonList, 100)).toBe(4);
  });

  it("ties share the rank, matching computePokemonRanks", () => {
    expect(rankForSumme(pokemonList, 600)).toBe(1);
    expect(rankForSumme(pokemonList, 440)).toBe(2);
  });
});
