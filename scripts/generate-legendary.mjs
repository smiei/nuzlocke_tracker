// Backfills data/pokemon.json with a `legendary` flag (true for both
// legendary AND mythical species, per PokeAPI's pokemon-species
// `is_legendary`/`is_mythical`) - powers the Pokédex tab's "only
// legendaries" filter. Skips entries that already have the field, so re-runs
// after generate-pokemon.mjs adds new entries only fetch what's missing.
//
// Run manually: node scripts/generate-legendary.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pokemonPath = path.join(__dirname, "..", "data", "pokemon.json");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const pokemon = JSON.parse(await readFile(pokemonPath, "utf-8"));
  const missing = pokemon.filter((p) => typeof p.legendary !== "boolean");
  if (missing.length === 0) {
    console.log(`pokemon.json: all ${pokemon.length} entries already have a legendary flag`);
    return;
  }

  const flagById = new Map();
  const batchSize = 8;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (p) => {
        const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`);
        flagById.set(p.id, species.is_legendary === true || species.is_mythical === true);
      }),
    );
    console.log(`legendary flags ${Math.min(i + batchSize, missing.length)}/${missing.length}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  const updated = pokemon.map((p) =>
    flagById.has(p.id) ? { ...p, legendary: flagById.get(p.id) } : p,
  );
  await writeFile(pokemonPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  const legendaryCount = updated.filter((p) => p.legendary).length;
  console.log(`pokemon.json: ${updated.length} entries, ${legendaryCount} legendary/mythical`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
