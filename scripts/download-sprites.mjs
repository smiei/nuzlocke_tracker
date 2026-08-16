// One-off script (not run at build/dev time): downloads the Pokémon battle
// sprites for every sprite set referenced by a game pack (game.json
// `spriteSet`) plus the Poké Ball item sprites from the PokeAPI sprite
// mirror, and saves them locally (public/pokemon-sprites/<set>/,
// public/ball-sprites/) so the running app never depends on an external CDN.
// Already-downloaded files are skipped, so re-runs only fetch what's missing.
// Run manually: node scripts/download-sprites.mjs
import { mkdir, writeFile, readFile, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const outRoot = path.join(__dirname, "..", "public", "pokemon-sprites");
const ballOutDir = path.join(__dirname, "..", "public", "ball-sprites");

// Sprite set name (game.json `spriteSet`) -> PokeAPI path + highest id the
// set contains.
// Gen 1/2 use the `transparent/` sub-folders: the default gen-i/gen-ii
// sprites carry a solid background, only the transparent variants have an
// alpha channel. Gen 3+ default sprites are already transparent.
const SPRITE_SETS = {
  "red-blue": { path: "versions/generation-i/red-blue/transparent", maxId: 151 },
  crystal: { path: "versions/generation-ii/crystal/transparent", maxId: 251 },
  // formFallbackPath: same-generation set to source a forme sprite from when
  // this one lacks it. In Gen 3 a Deoxys forme depended on the cartridge, so
  // Emerald only ships Speed while FireRed-LeafGreen ships Attack/Defense -
  // and every Gen 3 pack here renders with the Emerald set.
  emerald: {
    path: "versions/generation-iii/emerald",
    maxId: 386,
    formFallbackPath: "versions/generation-iii/firered-leafgreen",
  },
  "firered-leafgreen": { path: "versions/generation-iii/firered-leafgreen", maxId: 386 },
  platinum: { path: "versions/generation-iv/platinum", maxId: 493 },
  "black-white": { path: "versions/generation-v/black-white", maxId: 649 },
  "heartgold-soulsilver": { path: "versions/generation-iv/heartgold-soulsilver", maxId: 493 },
};

// Local ball id (see src/lib/catchrate.ts) -> PokeAPI item sprite name.
const BALLS = [
  "poke",
  "great",
  "ultra",
  "master",
  "safari",
  "net",
  "nest",
  "dive",
  "repeat",
  "timer",
  "luxury",
  "premier",
  "level",
  "lure",
  "moon",
  "friend",
  "love",
  "fast",
  "park",
  "quick",
  "dusk",
  "heal",
  "dream",
  "heavy",
  "sport",
];

async function download(url, target) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buffer);
}

// Pre-sprite-set layouts kept the emerald sprites flat in
// public/pokemon-sprites/*.png - move them into the emerald/ subfolder once
// instead of re-downloading ~386 files.
async function migrateFlatLayout() {
  if (!existsSync(outRoot)) return;
  const entries = await readdir(outRoot, { withFileTypes: true });
  const flat = entries.filter((e) => e.isFile() && /^\d+\.png$/.test(e.name));
  if (flat.length === 0) return;
  const emeraldDir = path.join(outRoot, "emerald");
  await mkdir(emeraldDir, { recursive: true });
  for (const file of flat) {
    const target = path.join(emeraldDir, file.name);
    if (!existsSync(target)) await rename(path.join(outRoot, file.name), target);
  }
  console.log(`migrated ${flat.length} flat sprites into emerald/`);
}

async function main() {
  await migrateFlatLayout();

  // Which sets do the installed game packs need?
  const gameDirs = await readdir(path.join(dataDir, "games"), { withFileTypes: true });
  const sets = new Set();
  for (const dir of gameDirs) {
    if (!dir.isDirectory()) continue;
    try {
      const game = JSON.parse(
        await readFile(path.join(dataDir, "games", dir.name, "game.json"), "utf-8"),
      );
      sets.add(game.spriteSet ?? "emerald");
    } catch {
      // No game.json - skip.
    }
  }

  const allPokemon = JSON.parse(await readFile(path.join(dataDir, "pokemon.json"), "utf-8"));
  // Species only: forme ids start at 10001 and are fetched separately below,
  // so they must not stretch the plain 1..maxId range.
  const maxKnownId = allPokemon
    .filter((p) => p.baseId === undefined)
    .map((p) => p.id)
    .reduce((a, b) => Math.max(a, b), 0);
  const formEntries = allPokemon.filter((p) => p.baseId !== undefined);

  for (const set of sets) {
    const config = SPRITE_SETS[set];
    if (!config) {
      console.warn(`[warn] unknown sprite set "${set}" - skipping`);
      continue;
    }
    const outDir = path.join(outRoot, set);
    await mkdir(outDir, { recursive: true });
    const ids = [];
    for (let id = 1; id <= Math.min(config.maxId, maxKnownId); id++) {
      if (!existsSync(path.join(outDir, `${id}.png`))) ids.push(id);
    }
    if (ids.length === 0) {
      console.log(`${set}: complete`);
      continue;
    }
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await Promise.all(
        batch.map((id) =>
          download(
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${config.path}/${id}.png`,
            path.join(outDir, `${id}.png`),
          ),
        ),
      );
      console.log(`${set}: ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
      if (i + batchSize < ids.length) await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Alternate-forme sprites (ids 10001+, see scripts/generate-forms.mjs).
  // Coverage is genuinely patchy per set - in the real games a Deoxys forme
  // depended on the cartridge, so PokeAPI only has Attack/Defense for
  // FireRed-LeafGreen and Speed for Emerald - and later formes (Rotom,
  // Giratina Origin, Shaymin Sky) don't exist before Gen 4 at all. A missing
  // one is therefore expected, not an error: skip it and let PokemonSprite
  // fall back.
  for (const set of sets) {
    const config = SPRITE_SETS[set];
    if (!config) continue;
    const outDir = path.join(outRoot, set);
    const wanted = formEntries.filter(
      (f) => f.baseId <= config.maxId && !existsSync(path.join(outDir, `${f.id}.png`)),
    );
    if (wanted.length === 0) continue;
    let saved = 0;
    const paths = [config.path, config.formFallbackPath].filter(Boolean);
    for (const form of wanted) {
      for (const spritePath of paths) {
        try {
          await download(
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spritePath}/${form.id}.png`,
            path.join(outDir, `${form.id}.png`),
          );
          saved++;
          break;
        } catch {
          // Not in this set - try the fallback, else leave it missing.
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    console.log(`${set}: ${saved}/${wanted.length} forme sprites`);
  }

  await mkdir(ballOutDir, { recursive: true });
  const missingBalls = BALLS.filter((b) => !existsSync(path.join(ballOutDir, `${b}.png`)));
  await Promise.all(
    missingBalls.map((ball) =>
      download(
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${ball}-ball.png`,
        path.join(ballOutDir, `${ball}.png`),
      ),
    ),
  );
  console.log(`ball sprites: ${missingBalls.length} downloaded, ${BALLS.length} total`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
