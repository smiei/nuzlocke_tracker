// One-off script (not run at build/dev time): downloads every Pokémon sprite
// used by this app from the PokeAPI sprite mirror and saves them locally to
// public/pokemon-sprites, so the running app never depends on an external
// CDN (avoids GitHub raw-content throttling under bursts of requests, e.g.
// the full Pokédex table loading ~386 sprites at once).
// Run manually: node scripts/download-sprites.mjs
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pokemonListPath = path.join(__dirname, "..", "data", "pokemon.json");
const outDir = path.join(__dirname, "..", "public", "pokemon-sprites");

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/emerald/${id}.png`;
}

async function downloadOne(id) {
  const res = await fetch(spriteUrl(id));
  if (!res.ok) throw new Error(`sprite ${id} -> HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, `${id}.png`), buffer);
}

async function main() {
  const pokemonList = JSON.parse(await readFile(pokemonListPath, "utf-8"));
  const ids = pokemonList.map((p) => p.id).sort((a, b) => a - b);

  await mkdir(outDir, { recursive: true });

  const batchSize = 10;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await Promise.all(batch.map(downloadOne));
    console.log(`downloaded ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    if (i + batchSize < ids.length) await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`Saved ${ids.length} sprites to public/pokemon-sprites/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
