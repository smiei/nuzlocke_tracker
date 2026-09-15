// Generates data/shared/infinite-fusion-species.json: Infinite Fusion's OWN
// species table (types, base stats, catch rates, weights) for the two
// Infinite Fusion packs, which differ from this app's shared pokemon.json in
// ways no correction table covers - the game sits on pre-Gen-6 base stats for
// many species, has its own catch rates, and does have Fairy typings that
// pokemon.json (deliberately pre-Fairy) does not.
//
// Source: the game's own compiled PBS data, Data/species.dat in
// github.com/infinitefusion/infinitefusion-e18 - a Ruby Marshal dump, read
// here with @hyrious/marshal (a devDependency; nothing at runtime touches it).
// Downloaded on demand, so no clone of that repo is needed. Its HEAD is game
// version 6.2.4 while the game is on 6.7, and it covers 501 species against
// the 572 in species.json - species it does not know keep this app's shared
// data, which is why the output is an override list, not a replacement.
//
// Run manually: node scripts/generate-infinite-fusion-species.mjs
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "@hyrious/marshal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const RAW = "https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/HEAD";
// The pack whose species.json carries the ifId -> our id mapping (both packs
// share the same file, guarded by infiniteFusionPacks.test.ts).
const MAPPING_PACK = "infinite-fusion-classic";
const OUT = path.join(dataDir, "shared", "infinite-fusion-species.json");

const ivar = (object, name) => object[Symbol.for("@" + name)];
const symbolName = (value) => (typeof value === "symbol" ? Symbol.keyFor(value) : value);

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function readLocalJson(...segments) {
  return JSON.parse(await readFile(path.join(dataDir, ...segments), "utf-8"));
}

// The game's six stats -> this app's stat keys (same order as PokemonStats).
const STAT_KEYS = [
  ["HP", "KP"],
  ["ATTACK", "Ang."],
  ["DEFENSE", "Vert."],
  ["SPECIAL_ATTACK", "Sp.-A."],
  ["SPECIAL_DEFENSE", "Sp.-V."],
  ["SPEED", "Init."],
];

async function main() {
  const [speciesDat, versionText] = await Promise.all([
    download(`${RAW}/Data/species.dat`),
    download(`${RAW}/Data/VERSION`).then((buffer) => buffer.toString("utf-8").trim()),
  ]);
  const gameSpecies = Object.values(load(speciesDat));
  const mapping = await readLocalJson("games", MAPPING_PACK, "species.json");
  const ourIdByIfId = new Map(mapping.map((entry) => [entry.ifId, entry.ourId]));
  const pokemon = new Map((await readLocalJson("pokemon.json")).map((p) => [p.id, p]));
  const catchRates = new Map(
    (await readLocalJson("catchrates.json")).map((entry) => [entry.id, entry.catch_rate]),
  );

  const out = [];
  const diffs = { types: 0, stats: 0, catchRate: 0, weight: 0 };
  let unmapped = 0;
  let unknownToUs = 0;

  for (const entry of gameSpecies) {
    // Alternate forms are their own species entries in this pack's mapping,
    // so a form row here (form > 0) would double-write its base species.
    if (ivar(entry, "form") > 0) continue;
    const ifId = ivar(entry, "id_number");
    const ourId = ourIdByIfId.get(ifId);
    if (ourId === undefined) {
      // Triple-fusion bosses (ZAPMOLTICUNO & co.) and anything added after
      // the species.json mapping was built.
      unmapped++;
      continue;
    }
    const ours = pokemon.get(ourId);
    if (!ours) {
      unknownToUs++;
      continue;
    }

    const types = [...new Set([ivar(entry, "type1"), ivar(entry, "type2")].filter(Boolean).map((t) => symbolName(t).toLowerCase()))];
    const baseStats = ivar(entry, "base_stats");
    const stats = {};
    for (const [gameKey, ourKey] of STAT_KEYS) stats[ourKey] = baseStats[Symbol.for(gameKey)];
    stats.Summe = STAT_KEYS.reduce((sum, [, ourKey]) => sum + stats[ourKey], 0);
    const catchRate = ivar(entry, "catch_rate");
    // The game stores weight in hectograms, this app in kilograms.
    const weight = Math.round(ivar(entry, "weight")) / 10;

    if (types.join("/") !== ours.types.join("/")) diffs.types++;
    if (STAT_KEYS.some(([, ourKey]) => stats[ourKey] !== ours.stats[ourKey])) diffs.stats++;
    if (catchRates.get(ourId) !== catchRate) diffs.catchRate++;
    if (ours.weight !== undefined && Math.abs(ours.weight - weight) > 0.05) diffs.weight++;

    out.push({ id: ourId, name: symbolName(ivar(entry, "id")), types, stats, catchRate, weight });
  }

  out.sort((a, b) => a.id - b.id);
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: "github.com/infinitefusion/infinitefusion-e18 Data/species.dat",
        sourceVersion: versionText,
        generatedAt: new Date().toISOString().slice(0, 10),
        species: out,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`wrote ${out.length} species to ${path.relative(process.cwd(), OUT)} (game version ${versionText})`);
  console.log(
    `differs from this app's shared data: ${diffs.types} types, ${diffs.stats} stat blocks, ${diffs.catchRate} catch rates, ${diffs.weight} weights`,
  );
  console.log(`skipped: ${unmapped} not in species.json (bosses/newer species), ${unknownToUs} without a pokemon.json entry`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
