// Builds data/pokemon-history.json: the per-Pokémon types and base stats as
// they were in the generations this app actually covers.
//
// Same systemic hazard as the move tables and the catch rates - PokeAPI's
// `types` and `stats` are the CURRENT values, and a lot changed after Gen 5:
//   * Gen 6 introduced Fairy and re-typed a batch of Pokémon (Togekiss went
//     Normal/Flying -> Fairy/Flying), a type that must never appear in a
//     Gen 1-5 game.
//   * Gen 5 gave the Rotom formes their appliance types; in Gen 4 (Platinum,
//     HeartGold/SoulSilver) all five were plain Electric/Ghost.
//   * Gen 6 buffed the base stats of ~30 Pokémon, which silently skews BST,
//     the Pokédex ranking and every team-strength comparison in the app.
//
// Unlike the move-name and catch-rate tables this one need not be curated by
// hand: PokeAPI exposes `past_types` and `past_stats`, keyed by the LAST
// generation the old value applied to - exactly the `maxGeneration` convention
// the other history files already use.
//
// Stat keys stay in PokeAPI's vocabulary here; src/lib/pokemonHistory.ts maps
// them to the German keys pokemon.json uses, so the data file has no opinion
// about the app's display format.
//
// Run manually: node scripts/generate-pokemon-history.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const GENERATIONS = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

// Nothing past Gen 5 can matter: every game pack in this app is Gen 1-5, so an
// override that only kicks in from Gen 6 on would be dead weight.
const MAX_RELEVANT_GENERATION = 5;

// PokeAPI is not infallible. Roserade's past_stats names the wrong stat: it
// reports attack=55, but Roserade's attack has always been 70 - what Gen 6
// raised was its DEFENCE, 55 -> 65 (Bulbapedia and PokemonDB agree, total
// 505 -> 515). Left alone this would show every Gen 1-5 run a Roserade with
// 15 points of attack it never lost.
// Keyed by id -> { wrongStat: correctStat }.
const STAT_NAME_FIXES = {
  407: { attack: "defense" },
};

// Every base-stat change from Gen 5 to Gen 6 was a flat +10 buff. That makes a
// cheap, total correctness check: any override whose delta against the current
// value is not exactly 10 is either a PokeAPI error or something genuinely new,
// and either way it must be looked at rather than shipped.
function reportImplausible(entries, current) {
  const suspect = [];
  for (const entry of entries) {
    if (!entry.stats || entry.maxGeneration !== 5) continue;
    const now = current.get(entry.id);
    if (!now) continue;
    for (const [stat, was] of Object.entries(entry.stats)) {
      const today = now[stat];
      if (today !== undefined && today - was !== 10) {
        suspect.push(`#${entry.id} ${stat}: ${was} -> ${today} (delta ${today - was})`);
      }
    }
  }
  return suspect;
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {
      // network hiccup - retry below
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error(`failed: ${url}`);
}

async function main() {
  const pokemon = JSON.parse(await readFile(path.join(dataDir, "pokemon.json"), "utf-8"));
  const ids = pokemon.map((p) => p.id);
  const out = [];
  const batch = 8;

  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    const results = await Promise.all(
      slice.map((id) => fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`)),
    );
    for (const entry of results) {
      if (!entry) continue;

      // past_types: one record per generation the typing changed after.
      for (const past of entry.past_types ?? []) {
        const gen = GENERATIONS[past.generation?.name];
        if (!gen || gen > MAX_RELEVANT_GENERATION) continue;
        out.push({
          id: entry.id,
          maxGeneration: gen,
          types: [...past.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        });
      }

      // past_stats: only the stats that actually differ are listed.
      for (const past of entry.past_stats ?? []) {
        const gen = GENERATIONS[past.generation?.name];
        if (!gen || gen > MAX_RELEVANT_GENERATION) continue;
        const stats = {};
        const fixes = STAT_NAME_FIXES[entry.id] ?? {};
        for (const s of past.stats ?? []) {
          stats[fixes[s.stat.name] ?? s.stat.name] = s.base_stat;
        }
        if (Object.keys(stats).length > 0) out.push({ id: entry.id, maxGeneration: gen, stats });
      }
    }
    if (i % 80 === 0) console.log(`  ${Math.min(i + batch, ids.length)}/${ids.length}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  // Stable order: by id, then by the generation the override stops applying.
  out.sort((a, b) => a.id - b.id || a.maxGeneration - b.maxGeneration);
  await writeFile(
    path.join(dataDir, "pokemon-history.json"),
    JSON.stringify(out, null, 2) + "\n",
    "utf-8",
  );

  const types = out.filter((e) => e.types).length;
  const stats = out.filter((e) => e.stats).length;
  console.log(`pokemon-history.json: ${out.length} entries (${types} type, ${stats} stat)`);

  const current = new Map(
    pokemon.map((p) => [
      p.id,
      {
        hp: p.stats?.["KP"],
        attack: p.stats?.["Ang."],
        defense: p.stats?.["Vert."],
        "special-attack": p.stats?.["Sp.-A."],
        "special-defense": p.stats?.["Sp.-V."],
        speed: p.stats?.["Init."],
      },
    ]),
  );
  const suspect = reportImplausible(out, current);
  if (suspect.length > 0) {
    console.warn(
      `
[warn] ${suspect.length} stat override(s) are not the expected +10 Gen 6 buff - verify each against Bulbapedia before trusting them:`,
    );
    for (const line of suspect) console.warn("  " + line);
  } else {
    console.log("all Gen 5 stat overrides are the expected +10 buff");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
