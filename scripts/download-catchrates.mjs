// One-off script (not run at build/dev time): fetches the base capture rate
// from PokeAPI (pokemon-species.capture_rate) for every Pokémon in
// data/pokemon.json and writes data/catchrates.json, so the Catchrate tab
// works fully offline. Run manually: npm run download:catchrates
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

async function fetchSpecies(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!res.ok) throw new Error(`pokemon-species/${id} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const pokemonList = JSON.parse(await readFile(path.join(dataDir, "pokemon.json"), "utf-8"));
  // Species only: alternate-forme entries (baseId set, ids 10001+) share their
  // species' data and have no pokemon-species endpoint of their own.
  const ids = [...new Set(pokemonList.filter((p) => p.baseId === undefined).map((p) => p.id))].sort(
    (a, b) => a - b,
  );

  const rates = new Map();
  const batchSize = 10;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        const species = await fetchSpecies(id);
        if (typeof species.capture_rate !== "number") {
          throw new Error(`pokemon-species/${id}: capture_rate missing`);
        }
        return { id, rate: species.capture_rate };
      }),
    );
    for (const { id, rate } of results) rates.set(id, rate);
    console.log(`fetched ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    if (i + batchSize < ids.length) await new Promise((r) => setTimeout(r, 150));
  }

  const output = ids.map((id) => ({ id, catch_rate: rates.get(id) }));
  await writeFile(
    path.join(dataDir, "catchrates.json"),
    JSON.stringify(output, null, 2) + "\n",
    "utf-8",
  );
  console.log(`Wrote data/catchrates.json (${output.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
