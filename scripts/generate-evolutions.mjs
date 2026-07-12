// One-off script (not run at build/dev time): fetches direct-predecessor
// evolution data plus HOW each evolution happens (level / item / trade /
// friendship, from the evolution-chain endpoint) from PokeAPI for every
// Pokémon in data/pokemon.json and writes data/evolutions.json.
// ROM-specific changes (e.g. a randomizer's "change impossible evolutions")
// belong in data/evolution-overrides.json, which the app merges at runtime -
// they survive re-running this script.
// Run manually: node scripts/generate-evolutions.mjs
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

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// Reduce PokeAPI evolution_details to the small structured method format the
// app renders (see EvolutionMethod in src/lib/data.ts).
function parseMethod(details) {
  const d = details?.[0];
  if (!d) return null;
  const trigger = d.trigger?.name;
  if (trigger === "use-item" && d.item) return { kind: "item", item: d.item.name };
  if (trigger === "trade") {
    return d.held_item ? { kind: "trade", item: d.held_item.name } : { kind: "trade" };
  }
  // "shed" (Ninjask/Shedinja) behaves like a plain level evolution in-game.
  if (trigger === "level-up" || trigger === "shed") {
    if (d.min_level) return { kind: "level", level: d.min_level };
    if (d.min_happiness) return { kind: "happiness", time: d.time_of_day || null };
    if (d.min_beauty) return { kind: "beauty" };
  }
  return { kind: "other" };
}

async function main() {
  const pokemonList = JSON.parse(await readFile(path.join(dataDir, "pokemon.json"), "utf-8"));
  const idSet = new Set(pokemonList.map((p) => p.id));
  const ids = [...idSet].sort((a, b) => a - b);

  const evolvesFrom = new Map();
  const chainUrls = new Set();
  const batchSize = 10;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const from = species.evolves_from_species
          ? extractIdFromUrl(species.evolves_from_species.url)
          : null;

        const pokemon = pokemonList.find((p) => p.id === id);
        const nameEn = pokemon.names?.en ?? pokemon.name_en;
        const expectedName = normalizeName(nameEn);
        if (expectedName !== species.name) {
          console.warn(
            `[sanity] id=${id}: name_en "${nameEn}" -> "${expectedName}", PokeAPI species name is "${species.name}"`,
          );
        }
        return { id, from, chainUrl: species.evolution_chain?.url ?? null };
      }),
    );
    for (const { id, from, chainUrl } of results) {
      evolvesFrom.set(id, from !== null && idSet.has(from) ? from : null);
      if (chainUrl) chainUrls.add(chainUrl);
    }
    console.log(`species ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    if (i + batchSize < ids.length) await new Promise((r) => setTimeout(r, 150));
  }

  // Walk every unique evolution chain to record HOW each child evolves.
  const methods = new Map();
  const urls = [...chainUrls];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        const chain = await fetchJson(url);
        const walk = (node) => {
          for (const child of node.evolves_to ?? []) {
            const childId = extractIdFromUrl(child.species.url);
            if (childId !== null && idSet.has(childId)) {
              const method = parseMethod(child.evolution_details);
              if (method) methods.set(childId, method);
            }
            walk(child);
          }
        };
        walk(chain.chain);
      }),
    );
    console.log(`chains ${Math.min(i + batchSize, urls.length)}/${urls.length}`);
    if (i + batchSize < urls.length) await new Promise((r) => setTimeout(r, 150));
  }

  const evolvesTo = new Map(ids.map((id) => [id, []]));
  for (const [id, from] of evolvesFrom) {
    if (from !== null) evolvesTo.get(from).push(id);
  }

  const output = ids.map((id) => {
    const from = evolvesFrom.get(id);
    const method = from !== null ? methods.get(id) ?? null : null;
    return {
      id,
      evolvesFrom: from,
      evolvesTo: evolvesTo.get(id),
      ...(method ? { method } : {}),
    };
  });

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
