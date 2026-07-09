// One-off script (not run at build/dev time): fetches direct-predecessor
// evolution data from PokeAPI for every Pokémon in data/pokemon.json and
// writes data/evolutions.json. Run manually: node scripts/generate-evolutions.mjs
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractIdFromUrl(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

async function fetchSpecies(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!res.ok) throw new Error(`pokemon-species/${id} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const pokemonList = JSON.parse(await readFile(path.join(dataDir, "pokemon.json"), "utf-8"));
  const idSet = new Set(pokemonList.map((p) => p.id));
  const ids = [...idSet].sort((a, b) => a - b);

  const evolvesFrom = new Map();
  const batchSize = 10;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        const species = await fetchSpecies(id);
        const from = species.evolves_from_species
          ? extractIdFromUrl(species.evolves_from_species.url)
          : null;

        const pokemon = pokemonList.find((p) => p.id === id);
        const expectedName = normalizeName(pokemon.name_en);
        if (expectedName !== species.name) {
          console.warn(
            `[sanity] id=${id}: name_en "${pokemon.name_en}" -> "${expectedName}", PokeAPI species name is "${species.name}"`,
          );
        }
        return { id, from };
      }),
    );
    for (const { id, from } of results) {
      evolvesFrom.set(id, from !== null && idSet.has(from) ? from : null);
    }
    console.log(`fetched ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    if (i + batchSize < ids.length) await new Promise((r) => setTimeout(r, 150));
  }

  const evolvesTo = new Map(ids.map((id) => [id, []]));
  for (const [id, from] of evolvesFrom) {
    if (from !== null) evolvesTo.get(from).push(id);
  }

  const output = ids.map((id) => ({
    id,
    evolvesFrom: evolvesFrom.get(id),
    evolvesTo: evolvesTo.get(id),
  }));

  await writeFile(
    path.join(dataDir, "evolutions.json"),
    JSON.stringify(output, null, 2) + "\n",
    "utf-8",
  );
  console.log(`Wrote data/evolutions.json (${output.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
