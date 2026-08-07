// Backfills data/pokemon.json with a `weight` field in kilograms (PokeAPI
// reports hectograms, so the raw value is divided by 10). Shown on the
// Pokédex info card, and the number the Heavy Ball / Low Kick / Grass Knot
// mechanics key off. Skips entries that already have the field, so re-runs
// after generate-pokemon.mjs adds new entries only fetch what's missing.
//
// Run manually: node scripts/generate-weights.mjs
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
  const missing = pokemon.filter((p) => typeof p.weight !== "number");
  if (missing.length === 0) {
    console.log(`pokemon.json: all ${pokemon.length} entries already have a weight`);
    return;
  }

  const weightById = new Map();
  const batchSize = 8;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (p) => {
        const mon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
        // Hectograms -> kilograms; one decimal is exactly what the games show.
        weightById.set(p.id, Math.round(mon.weight) / 10);
      }),
    );
    console.log(`weights ${Math.min(i + batchSize, missing.length)}/${missing.length}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  const updated = pokemon.map((p) =>
    weightById.has(p.id) ? { ...p, weight: weightById.get(p.id) } : p,
  );
  await writeFile(pokemonPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  console.log(`pokemon.json: ${updated.length} entries, ${weightById.size} weights added`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
