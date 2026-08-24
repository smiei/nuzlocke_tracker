import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { pokemonForGeneration, type PokemonHistoryEntry } from "@/lib/pokemonHistory";
import type { Pokemon } from "@/lib/data";

const root = process.cwd();
const read = <T,>(file: string): T =>
  JSON.parse(readFileSync(path.join(root, "data", file), "utf-8")) as T;

const history = read<PokemonHistoryEntry[]>("pokemon-history.json");
const pokemon = read<Pokemon[]>("pokemon.json");
const games = ["red-blue", "gold-silver", "firered", "emerald", "platinum", "heartgold", "soulsilver", "black", "white"];

const stats = (over: Partial<Pokemon["stats"]> = {}) => ({
  KP: 50, "Ang.": 50, "Vert.": 50, "Sp.-A.": 50, "Sp.-V.": 50, "Init.": 50, Summe: 300, ...over,
});
const mon = (id: number, types: string[], over = {}): Pokemon =>
  ({ id, names: { de: "x", en: "x" }, types, family_id: id, stats: stats(over), legendary: false }) as Pokemon;

describe("pokemonForGeneration", () => {
  const fixture: PokemonHistoryEntry[] = [
    { id: 468, maxGeneration: 5, types: ["normal", "flying"] },
    { id: 10008, maxGeneration: 4, types: ["electric", "ghost"] },
    { id: 18, maxGeneration: 5, stats: { speed: 91 } },
  ];

  it("strips a type the generation did not have yet", () => {
    expect(pokemonForGeneration(fixture, mon(468, ["fairy", "flying"]), 4).types).toEqual([
      "normal",
      "flying",
    ]);
  });

  it("stops applying past the generation it covers", () => {
    expect(pokemonForGeneration(fixture, mon(468, ["fairy", "flying"]), 6).types).toEqual([
      "fairy",
      "flying",
    ]);
  });

  it("handles a forme that changed later than its species", () => {
    // Heat Rotom was plain Electric/Ghost in Gen 4 and only took its appliance
    // type in Gen 5, so the same id needs different answers per generation.
    expect(pokemonForGeneration(fixture, mon(10008, ["electric", "fire"]), 4).types).toEqual([
      "electric",
      "ghost",
    ]);
    expect(pokemonForGeneration(fixture, mon(10008, ["electric", "fire"]), 5).types).toEqual([
      "electric",
      "fire",
    ]);
  });

  it("recomputes Summe when a stat is rolled back", () => {
    const out = pokemonForGeneration(fixture, mon(18, ["normal"], { "Init.": 101, Summe: 310 }), 5);
    expect(out.stats["Init."]).toBe(91);
    // Otherwise the card would print six stats that do not add up to their total.
    expect(out.stats.Summe).toBe(
      out.stats.KP + out.stats["Ang."] + out.stats["Vert."] + out.stats["Sp.-A."] + out.stats["Sp.-V."] + 91,
    );
  });

  it("returns the very same object when nothing applies", () => {
    const input = mon(1, ["grass", "poison"]);
    expect(pokemonForGeneration(fixture, input, 3)).toBe(input);
  });
});

describe("data/pokemon-history.json", () => {
  it("never lets Fairy reach a game this app ships", () => {
    // The bug that started this: Togekiss showed up as Fee in a HeartGold run.
    // Fairy did not exist before Gen 6 and no pack here is past Gen 5, so the
    // type must be unreachable for every single game.
    const generations = games.map((id) => {
      const game = JSON.parse(
        readFileSync(path.join(root, "data", "games", id, "game.json"), "utf-8"),
      ) as { generation: number };
      return game.generation;
    });
    for (const generation of new Set(generations)) {
      for (const entry of pokemon) {
        const corrected = pokemonForGeneration(history, entry, generation);
        expect(corrected.types, `#${entry.id} in gen ${generation}`).not.toContain("fairy");
      }
    }
  });

  it("keeps the Rotom formes Electric/Ghost in Gen 4", () => {
    for (const id of [10008, 10009, 10010, 10011, 10012]) {
      const base = pokemon.find((p) => p.id === id);
      if (!base) continue;
      expect(pokemonForGeneration(history, base, 4).types, String(id)).toEqual([
        "electric",
        "ghost",
      ]);
      // Gen 5 is where they gained the appliance type - it must NOT be stripped.
      expect(pokemonForGeneration(history, base, 5).types, String(id)).not.toEqual([
        "electric",
        "ghost",
      ]);
    }
  });

  it("rolls the Gen 6 base-stat buffs back, and only by the +10 each really was", () => {
    const KEYS: Record<string, keyof Pokemon["stats"]> = {
      hp: "KP",
      attack: "Ang.",
      defense: "Vert.",
      "special-attack": "Sp.-A.",
      "special-defense": "Sp.-V.",
      speed: "Init.",
    };
    for (const entry of history) {
      if (!entry.stats || entry.maxGeneration !== 5) continue;
      const now = pokemon.find((p) => p.id === entry.id);
      if (!now) continue;
      // Every Gen 6 change was a flat +10 on a single stat - but a Pokémon can
      // have caught more than one (Pikachu got Defence AND Sp. Def), so the
      // expected drop is 10 per changed stat.
      let expected = 0;
      for (const [apiKey, was] of Object.entries(entry.stats)) {
        const key = KEYS[apiKey];
        if (!key) continue;
        expect((now.stats[key] ?? 0) - (was as number), `#${entry.id} ${apiKey}`).toBe(10);
        expected += 10;
      }
      const then = pokemonForGeneration(history, now, 5);
      expect(then.stats.Summe, `#${entry.id}`).toBe(now.stats.Summe - expected);
    }
  });

  it("covers every Gen 1 species with a Special value", () => {
    const withSpecial = new Set(
      history.filter((e) => e.stats && "special" in e.stats).map((e) => e.id),
    );
    for (let id = 1; id <= 151; id++) expect(withSpecial.has(id), `#${id}`).toBe(true);
  });

  it("collapses Gen 1 to a single Special and counts it once in the total", () => {
    // Gen 1 had ONE Special stat driving both special attack and defence, and
    // its base stat total counts it once. Real cartridge values, HP/Atk/Def/
    // Special/Speed - Mewtwo is 590 there, not the 680 the split-era numbers
    // would give.
    const cases: [number, number, number, number, number, number][] = [
      [150, 106, 110, 90, 154, 130],
      [25, 35, 55, 30, 50, 90],
      [65, 55, 50, 45, 135, 120],
      [143, 160, 110, 65, 65, 30],
      [6, 78, 84, 78, 85, 100],
      [94, 60, 65, 60, 130, 110],
    ];
    for (const [id, hp, atk, def, special, speed] of cases) {
      const out = pokemonForGeneration(history, pokemon.find((p) => p.id === id)!, 1);
      expect(out.stats.Spezial, `#${id} Spezial`).toBe(special);
      expect(out.stats.Summe, `#${id} Summe`).toBe(hp + atk + def + special + speed);
      // Mirrored onto both split stats too, so a generic consumer still reads
      // the number the game actually used.
      expect(out.stats["Sp.-A."]).toBe(special);
      expect(out.stats["Sp.-V."]).toBe(special);
    }
  });

  it("never sets Spezial outside Gen 1", () => {
    // Its presence is what makes the UI drop to five stat rows, so a stray one
    // in Gen 2+ would silently hide a real stat.
    for (const generation of [2, 3, 4, 5]) {
      for (const entry of pokemon) {
        expect(
          pokemonForGeneration(history, entry, generation).stats.Spezial,
          `#${entry.id} gen ${generation}`,
        ).toBeUndefined();
      }
    }
  });
});
