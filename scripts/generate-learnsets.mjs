// Generates data/learnsets/<versionGroup>.json for every version group a game
// pack references (game.json `versionGroup`). Each file maps a national-dex id
// to the DAMAGING attack types the Pokémon can learn by level-up, with the
// LOWEST level at which each type first becomes available:
//   { "1": { "grass": 10, "normal": 1, "poison": 15 }, ... }
// Status moves (growl, etc.) are excluded - only physical/special count. The
// "Kampf" tab and the Pokédex detail card read this to show a Pokémon's
// offensive coverage at a given level.
//
// Approximation: PokeAPI's move `damage_class` is the Gen-4+ view. For the
// only distinction we need (damaging vs. status) that's stable across gens.
// A handful of Gen-1/2 move-type changes are ignored.
//
// Run manually: node scripts/generate-learnsets.mjs
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const outDir = path.join(dataDir, "learnsets");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  // Which version groups do the installed game packs need, and up to which id?
  const gameDirs = await readdir(path.join(dataDir, "games"), { withFileTypes: true });
  const versionGroups = new Map(); // vg -> maxDexId needed
  for (const dir of gameDirs) {
    if (!dir.isDirectory()) continue;
    try {
      const game = JSON.parse(
        await readFile(path.join(dataDir, "games", dir.name, "game.json"), "utf-8"),
      );
      const vg = game.versionGroup;
      if (!vg) continue;
      versionGroups.set(vg, Math.max(versionGroups.get(vg) ?? 0, game.dexLimit ?? 0));
    } catch {
      // No game.json - skip.
    }
  }

  const maxId = Math.max(0, ...versionGroups.values());
  // move name -> { type, damaging } (fetched once, reused across all games).
  const moveCache = new Map();
  // vg -> { [pokemonId]: { [type]: minLevel } }
  const result = new Map([...versionGroups.keys()].map((vg) => [vg, {}]));

  const batchSize = 4;
  for (let id = 1; id <= maxId; id += batchSize) {
    const ids = [];
    for (let n = id; n < id + batchSize && n <= maxId; n++) ids.push(n);
    await Promise.all(
      ids.map(async (pid) => {
        const mon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${pid}`);
        for (const m of mon.moves) {
          const moveName = m.move.name;
          // Which of our version groups teach this move by level-up, at what level?
          const perVg = new Map();
          for (const v of m.version_group_details) {
            if (v.move_learn_method.name !== "level-up") continue;
            const vg = v.version_group.name;
            if (!result.has(vg)) continue;
            if (pid > (versionGroups.get(vg) ?? 0)) continue;
            const lvl = v.level_learned_at || 1;
            perVg.set(vg, Math.min(perVg.get(vg) ?? Infinity, lvl));
          }
          if (perVg.size === 0) continue;

          if (!moveCache.has(moveName)) {
            const move = await fetchJson(m.move.url);
            moveCache.set(moveName, {
              type: move.type.name,
              damaging: move.damage_class?.name !== "status",
            });
          }
          const info = moveCache.get(moveName);
          if (!info.damaging) continue;

          for (const [vg, lvl] of perVg) {
            const table = result.get(vg);
            const entry = (table[pid] ??= {});
            entry[info.type] = Math.min(entry[info.type] ?? Infinity, lvl);
          }
        }
      }),
    );
    console.log(`pokemon ${Math.min(id + batchSize - 1, maxId)}/${maxId}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  await mkdir(outDir, { recursive: true });
  for (const [vg, table] of result) {
    // Sort ids numerically and types by level for stable, readable files.
    const sorted = {};
    for (const pid of Object.keys(table).map(Number).sort((a, b) => a - b)) {
      const types = Object.entries(table[pid]).sort((a, b) => a[1] - b[1]);
      sorted[pid] = Object.fromEntries(types);
    }
    await writeFile(path.join(outDir, `${vg}.json`), JSON.stringify(sorted) + "\n", "utf-8");
    console.log(`learnsets/${vg}.json: ${Object.keys(sorted).length} Pokémon`);
  }
  console.log(`cached ${moveCache.size} unique moves`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
