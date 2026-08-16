import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { historicalMoveNames, type MoveNameHistoryEntry } from "@/lib/learnset";

const read = <T,>(file: string): T =>
  JSON.parse(readFileSync(path.join(process.cwd(), "data", file), "utf-8")) as T;

const history = read<MoveNameHistoryEntry[]>("move-name-history.json");
const moves = read<Record<string, { names: Record<string, string> }>>("moves.json");

describe("historicalMoveNames", () => {
  const fixture: MoveNameHistoryEntry[] = [
    { slug: "pound", maxGeneration: 7, names: { de: "Pfund" } },
    { slug: "transform", minGeneration: 2, maxGeneration: 2, names: { de: "Verwandler" } },
  ];
  const pound = { de: "Klaps", en: "Pound", fr: "Écras'Face" };

  it("returns the historical name for a covered generation", () => {
    expect(historicalMoveNames(fixture, "pound", 3, pound).de).toBe("Pfund");
    expect(historicalMoveNames(fixture, "pound", 7, pound).de).toBe("Pfund");
  });

  it("falls back to the current name past maxGeneration", () => {
    expect(historicalMoveNames(fixture, "pound", 8, pound).de).toBe("Klaps");
  });

  it("leaves languages the entry does not mention untouched", () => {
    const out = historicalMoveNames(fixture, "pound", 3, pound);
    expect(out.en).toBe("Pound");
    expect(out.fr).toBe("Écras'Face");
  });

  it("honours minGeneration for a move that was renamed and renamed back", () => {
    const t = { de: "Wandler", en: "Transform" };
    expect(historicalMoveNames(fixture, "transform", 1, t).de).toBe("Wandler");
    expect(historicalMoveNames(fixture, "transform", 2, t).de).toBe("Verwandler");
    expect(historicalMoveNames(fixture, "transform", 3, t).de).toBe("Wandler");
  });

  it("passes through moves with no history entry", () => {
    const tackle = { de: "Tackle", en: "Tackle" };
    expect(historicalMoveNames(fixture, "tackle", 1, tackle)).toBe(tackle);
  });
});

describe("data/move-name-history.json", () => {
  it("only references moves that exist", () => {
    for (const entry of history) expect(moves[entry.slug], entry.slug).toBeDefined();
  });

  it("actually differs from the current name, i.e. no dead entries", () => {
    // A failure here means PokeAPI's name now matches the historical one and
    // the entry can go - or that a name was curated wrong in the first place.
    for (const entry of history) {
      for (const [lang, name] of Object.entries(entry.names)) {
        expect(moves[entry.slug].names[lang], entry.slug).not.toBe(name);
      }
    }
  });

  it("covers the generations this app actually ships games for", () => {
    // Every game pack is Gen 1-5; an entry ending before Gen 1 would be dead
    // weight, and PokeAPI already serves anything from Gen 8 on.
    for (const entry of history) {
      expect(entry.maxGeneration, entry.slug).toBeGreaterThanOrEqual(entry.minGeneration ?? 1);
      expect(entry.maxGeneration, entry.slug).toBeLessThan(9);
    }
  });

  it("restores the names the user reported: Pfund, not Klaps", () => {
    const de = (slug: string, gen: number) =>
      historicalMoveNames(history, slug, gen, moves[slug].names).de;
    expect(de("pound", 4)).toBe("Pfund");
    expect(de("peck", 3)).toBe("Schnabel");
    expect(de("glare", 2)).toBe("Giftblick");
    expect(de("grass-pledge", 5)).toBe("Pflanzsäulen");
  });
});
