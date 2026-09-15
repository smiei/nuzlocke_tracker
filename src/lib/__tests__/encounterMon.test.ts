import { describe, it, expect } from "vitest";
import { resolveEncounterMon } from "@/lib/encounterMon";
import type { Pokemon } from "@/lib/data";

const mon = (id: number, types: string[], stats: Pokemon["stats"], names?: Partial<Pokemon["names"]>): Pokemon => ({
  id,
  names: { de: `#${id}`, en: `#${id}`, ...names },
  types,
  family_id: id,
  stats,
  legendary: false,
});

const bulbasaur = mon(1, ["grass", "poison"], {
  KP: 45, "Ang.": 49, "Vert.": 49, "Sp.-A.": 65, "Sp.-V.": 65, "Init.": 45, Summe: 318,
}, { en: "Bulbasaur" });
const ivysaur = mon(2, ["grass", "poison"], {
  KP: 60, "Ang.": 62, "Vert.": 63, "Sp.-A.": 80, "Sp.-V.": 80, "Init.": 60, Summe: 405,
}, { en: "Ivysaur" });
const charmander = mon(4, ["fire"], {
  KP: 39, "Ang.": 52, "Vert.": 43, "Sp.-A.": 60, "Sp.-V.": 50, "Init.": 65, Summe: 309,
}, { en: "Charmander" });
const charmeleon = mon(5, ["fire"], {
  KP: 58, "Ang.": 64, "Vert.": 58, "Sp.-A.": 80, "Sp.-V.": 65, "Init.": 80, Summe: 405,
}, { en: "Charmeleon" });

const pokemonById = (id: number) => [bulbasaur, ivysaur, charmander, charmeleon].find((p) => p.id === id);
const evolvesTo = (id: number) => (id === 1 ? [2] : id === 4 ? [5] : []);
const inDex = () => true;
const deps = { pokemonById, evolvesTo, inDex, lang: "en" as const };

describe("resolveEncounterMon without a donor", () => {
  it("returns exactly the head's own name/types/stats", () => {
    const out = resolveEncounterMon(1, null, deps);
    expect(out).toEqual({
      headId: 1,
      bodyId: null,
      name: "Bulbasaur",
      types: ["grass", "poison"],
      stats: bulbasaur.stats,
      summeMax: 405, // Ivysaur, its best evolution
    });
  });

  it("returns null when the head doesn't resolve", () => {
    expect(resolveEncounterMon(999, null, deps)).toBeNull();
  });

  it("falls back to head-only when the donor id doesn't resolve (data drift)", () => {
    const out = resolveEncounterMon(1, 999, deps);
    expect(out?.bodyId).toBeNull();
    expect(out?.name).toBe("Bulbasaur");
  });
});

describe("resolveEncounterMon with a donor (fusion)", () => {
  it("combines both names, computes fusion types and stats", () => {
    const out = resolveEncounterMon(1, 4, deps)!;
    expect(out.headId).toBe(1);
    expect(out.bodyId).toBe(4);
    expect(out.name).toBe("Bulbasaur / Charmander");
    // grass primary (head), fire has no secondary so body contributes its primary
    expect(out.types).toEqual(["grass", "fire"]);
    expect(out.stats).toEqual({
      KP: 43, "Ang.": 51, "Vert.": 45, "Sp.-A.": 63, "Sp.-V.": 60, "Init.": 58, Summe: 320,
    });
  });

  it("summeMax fuses each side's OWN best evolution, not the current forms", () => {
    const out = resolveEncounterMon(1, 4, deps)!;
    // Ivysaur (405) fused with Charmeleon (405), not Bulbasaur+Charmander.
    const expected =
      Math.floor((2 * 60 + 58) / 3) + // KP, head-dominant (Ivysaur)
      Math.floor((2 * 64 + 62) / 3) + // Ang., body-dominant (Charmeleon)
      Math.floor((2 * 58 + 63) / 3) + // Vert., body-dominant (Charmeleon)
      Math.floor((2 * 80 + 80) / 3) + // Sp.-A., head-dominant (Ivysaur)
      Math.floor((2 * 80 + 65) / 3) + // Sp.-V., head-dominant (Ivysaur)
      Math.floor((2 * 80 + 60) / 3); // Init., body-dominant (Charmeleon)
    expect(out.summeMax).toBe(expected);
    expect(out.summeMax).toBeGreaterThan(out.stats.Summe);
  });
});
