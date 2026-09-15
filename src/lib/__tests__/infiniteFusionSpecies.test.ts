import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Guards the output of scripts/generate-infinite-fusion-packs.mjs - both
// packs share ONE species.json (see CLAUDE.md's Infinite Fusion section), so
// this pins that they stay identical and that the mapping itself is sound,
// independent of whether the reference clone that generated it is present.

const root = process.cwd();
const classicPath = path.join(root, "data", "games", "infinite-fusion-classic", "species.json");

describe.skipIf(!existsSync(classicPath))("Infinite Fusion species.json", () => {
  type SpeciesEntry = { ifId: number; ourId: number };
  const classic = JSON.parse(readFileSync(classicPath, "utf-8")) as SpeciesEntry[];
  const remix = JSON.parse(
    readFileSync(path.join(root, "data", "games", "infinite-fusion-remix", "species.json"), "utf-8"),
  ) as SpeciesEntry[];
  const pokemon = JSON.parse(readFileSync(path.join(root, "data", "pokemon.json"), "utf-8")) as {
    id: number;
  }[];
  const ourIds = new Set(pokemon.map((p) => p.id));

  it("is byte-for-byte identical between Classic and Remix", () => {
    expect(remix).toEqual(classic);
  });

  it("has 572 entries, one per Infinite Fusion species", () => {
    expect(classic).toHaveLength(572);
  });

  it("every ifId is unique and sorted ascending", () => {
    const ids = classic.map((e) => e.ifId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("every ourId is unique - no two Infinite Fusion species collapse onto the same app id", () => {
    const ourIdList = classic.map((e) => e.ourId);
    expect(new Set(ourIdList).size).toBe(ourIdList.length);
  });

  it("every ourId resolves to a real pokemon.json entry", () => {
    for (const e of classic) expect(ourIds.has(e.ourId), `ourId ${e.ourId} (IF #${e.ifId})`).toBe(true);
  });

  it("maps the six dex-colliding species to the correct forme ids, not their species id", () => {
    // Oricorio: Baile keeps the species id (741); the other three styles are
    // formes generate-forms.mjs adds specifically for this pack.
    const oricorio = classic.filter((e) => [430, 431, 432, 433].includes(e.ifId));
    expect(oricorio.map((e) => e.ourId).sort((a, b) => a - b)).toEqual([741, 10123, 10124, 10125]);
    // Lycanroc: only Midday (species id) and Midnight (forme) are in IF's dex.
    const lycanroc = classic.filter((e) => [464, 465].includes(e.ifId));
    expect(lycanroc.map((e) => e.ourId).sort((a, b) => a - b)).toEqual([745, 10126]);
    // Necrozma: only base (species id) and Ultra (forme).
    const necrozma = classic.filter((e) => [450, 470].includes(e.ifId));
    expect(necrozma.map((e) => e.ourId).sort((a, b) => a - b)).toEqual([800, 10157]);
    // Minior: Meteor (species id) and Core (one forme representing all 7 colours).
    const minior = classic.filter((e) => [498, 499].includes(e.ifId));
    expect(minior.map((e) => e.ourId).sort((a, b) => a - b)).toEqual([774, 10136]);
  });
});
