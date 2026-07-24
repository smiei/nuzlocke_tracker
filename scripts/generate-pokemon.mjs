// Extends data/pokemon.json up to a target national-dex id (default 493 =
// Gen 4) with entries generated from PokeAPI: localized names, types, base
// stats, and family_id (root species of the evolution chain). EXISTING
// entries are never touched - the hand-curated 1-386 data stays as is.
// After running this, re-run generate:evolutions, download:catchrates,
// generate:names, and download:sprites so the other data files catch up.
//
// Run manually: node scripts/generate-pokemon.mjs [maxId]
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pokemonPath = path.join(__dirname, "..", "data", "pokemon.json");

const MAX_ID = Number(process.argv[2]) || 493;
const LANGS = ["de", "en", "fr", "es", "it"];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function idFromUrl(url) {
  return Number(url.replace(/\/$/, "").split("/").pop());
}

// PokeAPI stat slugs -> the German stat keys the app uses.
const STAT_KEYS = {
  hp: "KP",
  attack: "Ang.",
  defense: "Vert.",
  "special-attack": "Sp.-A.",
  "special-defense": "Sp.-V.",
  speed: "Init.",
};

async function main() {
  const pokemon = JSON.parse(await readFile(pokemonPath, "utf-8"));
  const existing = new Set(pokemon.map((p) => p.id));
  const missing = [];
  for (let id = 1; id <= MAX_ID; id++) if (!existing.has(id)) missing.push(id);
  if (missing.length === 0) {
    console.log(`pokemon.json already covers ids 1-${MAX_ID}`);
    return;
  }

  const batchSize = 5;
  const added = [];
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const entries = await Promise.all(
      batch.map(async (id) => {
        const [mon, species] = await Promise.all([
          fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`),
          fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
        ]);
        const chain = await fetchJson(species.evolution_chain.url);

        const names = {};
        for (const lang of LANGS) {
          const hit = species.names.find((n) => n.language?.name === lang);
          names[lang] = hit?.name ?? species.names.find((n) => n.language?.name === "en")?.name;
        }

        const stats = {};
        let sum = 0;
        for (const s of mon.stats) {
          const key = STAT_KEYS[s.stat.name];
          if (!key) continue;
          stats[key] = s.base_stat;
          sum += s.base_stat;
        }
        stats.Summe = sum;

        return {
          id,
          names,
          types: mon.types.map((t) => t.type.name),
          family_id: idFromUrl(chain.chain.species.url),
          stats,
          legendary: species.is_legendary === true || species.is_mythical === true,
        };
      }),
    );
    added.push(...entries);
    console.log(`pokemon ${Math.min(i + batchSize, missing.length)}/${missing.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  const all = [...pokemon, ...added].sort((a, b) => a.id - b.id);
  await writeFile(pokemonPath, JSON.stringify(all, null, 2) + "\n", "utf-8");
  console.log(`pokemon.json: ${all.length} entries (added ${added.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
