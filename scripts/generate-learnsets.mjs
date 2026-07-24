// Generates level-up move data for every version group a game pack references
// (game.json `versionGroup`), in three shapes:
//
//  data/learnsets/<vg>.json  { id: { type: minLevel } }   DAMAGING types only
//      -> the "Kampf" tab's offensive coverage + team matchup.
//  data/movesets/<vg>.json   { id: [[level, slug], ...] }  ALL level-up moves
//      -> the Pokédex info card's move list + the self-destruct/explosion warn.
//  data/moves.json           { slug: { names:{de,en,..}, type, damaging } }
//      -> localized move names / type / damage-class, shared across games.
//  data/tm-compat/<vg>.json  { slug: { machine?:{kind,ids}, tutor?:ids } }
//      -> the TM/HM/tutor tab: which Pokémon can OFFICIALLY learn a move via
//         machine (kind = "tm"|"hm") or a move tutor, per version group.
//
// Approximation: PokeAPI's move `damage_class` is the Gen-4+ view. For the
// only distinction we need (damaging vs. status) that's stable across gens.
//
// data/moves.json stores each move's CURRENT (latest-generation) type, same
// as PokeAPI. A few moves were retyped at some point in the games' real
// history though (Bite/Gust/Karate Chop/Sand Attack: Normal until Gen 3;
// Charm/Moonlight/Sweet Kiss: Normal until Fairy existed in Gen 6; Curse: the
// old "???" type until Gen 6) - data/move-type-history.json hand-curates
// those (found via each move's PokeAPI `past_values`) and is applied here
// per-version-group when building the DAMAGING-type learnsets (which double
// as object keys, so they can't stay wrong the way a display-only field
// could) - see historicalMoveType() in src/lib/learnset.ts, which the
// Pokédex move list applies the same table through at render time instead,
// since moves.json itself is shared/generation-agnostic.
//
// Run manually: node scripts/generate-learnsets.mjs
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const learnsetsDir = path.join(dataDir, "learnsets");
const movesetsDir = path.join(dataDir, "movesets");
const tmCompatDir = path.join(dataDir, "tm-compat");

const LANGS = ["de", "en", "fr", "es", "it"];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// slug -> { type, maxGeneration } for O(1) lookup while building learnsets.
async function loadMoveTypeHistory() {
  const raw = JSON.parse(
    await readFile(path.join(dataDir, "move-type-history.json"), "utf-8"),
  );
  return new Map(raw.map((e) => [e.slug, e]));
}

// The type a move actually had in the given generation - see
// data/move-type-history.json and the header comment above.
function historicalType(moveTypeHistory, slug, generation, currentType) {
  const entry = moveTypeHistory.get(slug);
  return entry && generation <= entry.maxGeneration ? entry.type : currentType;
}

async function main() {
  // Which version groups do the installed game packs need, and up to which id?
  const gameDirs = await readdir(path.join(dataDir, "games"), { withFileTypes: true });
  const versionGroups = new Map(); // vg -> maxDexId needed
  const vgGeneration = new Map(); // vg -> generation (for historicalType())
  for (const dir of gameDirs) {
    if (!dir.isDirectory()) continue;
    try {
      const game = JSON.parse(
        await readFile(path.join(dataDir, "games", dir.name, "game.json"), "utf-8"),
      );
      const vg = game.versionGroup;
      if (!vg) continue;
      versionGroups.set(vg, Math.max(versionGroups.get(vg) ?? 0, game.dexLimit ?? 0));
      vgGeneration.set(vg, game.generation);
    } catch {
      // No game.json - skip.
    }
  }
  const moveTypeHistory = await loadMoveTypeHistory();

  const maxId = Math.max(0, ...versionGroups.values());
  // slug -> { type, damaging, names } (fetched once, reused across all games).
  const moveCache = new Map();
  const typeLearnsets = new Map([...versionGroups.keys()].map((vg) => [vg, {}]));
  const movesets = new Map([...versionGroups.keys()].map((vg) => [vg, {}]));
  const tmCompat = new Map([...versionGroups.keys()].map((vg) => [vg, {}]));
  // TM/HM classification: machine detail url -> "tm"|"hm" (cached globally),
  // and slug -> { <vg>: "tm"|"hm" } for our version groups (from move.machines).
  const machineKindCache = new Map();
  const machineKindBySlug = new Map();

  const batchSize = 4;
  for (let id = 1; id <= maxId; id += batchSize) {
    const ids = [];
    for (let n = id; n < id + batchSize && n <= maxId; n++) ids.push(n);
    await Promise.all(
      ids.map(async (pid) => {
        const mon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${pid}`);
        for (const m of mon.moves) {
          const slug = m.move.name;
          // Per our version groups: level-up (min level), machine (TM/HM), tutor.
          const levelPerVg = new Map();
          const machineVgs = new Set();
          const tutorVgs = new Set();
          for (const v of m.version_group_details) {
            const vg = v.version_group.name;
            if (!movesets.has(vg)) continue;
            if (pid > (versionGroups.get(vg) ?? 0)) continue;
            const method = v.move_learn_method.name;
            if (method === "level-up") {
              const lvl = v.level_learned_at || 1;
              levelPerVg.set(vg, Math.min(levelPerVg.get(vg) ?? Infinity, lvl));
            } else if (method === "machine") {
              machineVgs.add(vg);
            } else if (method === "tutor") {
              tutorVgs.add(vg);
            }
          }
          if (levelPerVg.size === 0 && machineVgs.size === 0 && tutorVgs.size === 0) continue;

          // Fetch the move once: localized names + type + (for machine moves)
          // TM-vs-HM per version group from move.machines -> machine.item name.
          if (!moveCache.has(slug)) {
            const move = await fetchJson(m.move.url);
            const names = {};
            for (const lang of LANGS) {
              const hit = move.names.find((n) => n.language?.name === lang);
              names[lang] = hit?.name ?? move.names.find((n) => n.language?.name === "en")?.name ?? slug;
            }
            moveCache.set(slug, {
              type: move.type.name,
              damaging: move.damage_class?.name !== "status",
              names,
            });
            const kinds = {};
            for (const mac of move.machines ?? []) {
              const vg = mac.version_group?.name;
              if (!movesets.has(vg) || !mac.machine?.url) continue;
              if (!machineKindCache.has(mac.machine.url)) {
                const md = await fetchJson(mac.machine.url);
                machineKindCache.set(mac.machine.url, md.item?.name?.startsWith("hm") ? "hm" : "tm");
              }
              kinds[vg] = machineKindCache.get(mac.machine.url);
            }
            machineKindBySlug.set(slug, kinds);
          }
          const info = moveCache.get(slug);

          for (const [vg, lvl] of levelPerVg) {
            // Full moveset (all level-up moves).
            (movesets.get(vg)[pid] ??= []).push([lvl, slug]);
            // Damaging-type coverage learnset - type corrected for this
            // version group's generation (see historicalType() above).
            if (info.damaging) {
              const type = historicalType(moveTypeHistory, slug, vgGeneration.get(vg), info.type);
              const table = typeLearnsets.get(vg);
              const entry = (table[pid] ??= {});
              entry[type] = Math.min(entry[type] ?? Infinity, lvl);
            }
          }
          for (const vg of machineVgs) {
            const entry = (tmCompat.get(vg)[slug] ??= {});
            const kind = machineKindBySlug.get(slug)?.[vg] ?? "tm";
            (entry.machine ??= { kind, ids: [] }).ids.push(pid);
          }
          for (const vg of tutorVgs) {
            const entry = (tmCompat.get(vg)[slug] ??= {});
            (entry.tutor ??= []).push(pid);
          }
        }
      }),
    );
    console.log(`pokemon ${Math.min(id + batchSize - 1, maxId)}/${maxId}`);
    await new Promise((r) => setTimeout(r, 120));
  }

  await mkdir(learnsetsDir, { recursive: true });
  await mkdir(movesetsDir, { recursive: true });
  await mkdir(tmCompatDir, { recursive: true });

  for (const [vg, table] of typeLearnsets) {
    const sorted = {};
    for (const pid of Object.keys(table).map(Number).sort((a, b) => a - b)) {
      sorted[pid] = Object.fromEntries(Object.entries(table[pid]).sort((a, b) => a[1] - b[1]));
    }
    await writeFile(path.join(learnsetsDir, `${vg}.json`), JSON.stringify(sorted) + "\n", "utf-8");
    console.log(`learnsets/${vg}.json: ${Object.keys(sorted).length} Pokémon`);
  }

  for (const [vg, table] of movesets) {
    const sorted = {};
    for (const pid of Object.keys(table).map(Number).sort((a, b) => a - b)) {
      // Sort by level, then by slug; drop duplicate slugs (keep lowest level).
      const seen = new Set();
      const list = table[pid]
        .sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])))
        .filter(([, slug]) => (seen.has(slug) ? false : (seen.add(slug), true)));
      sorted[pid] = list;
    }
    await writeFile(path.join(movesetsDir, `${vg}.json`), JSON.stringify(sorted) + "\n", "utf-8");
    console.log(`movesets/${vg}.json: ${Object.keys(sorted).length} Pokémon`);
  }

  for (const [vg, table] of tmCompat) {
    const sorted = {};
    for (const slug of Object.keys(table).sort()) {
      const e = table[slug];
      const out = {};
      if (e.machine) {
        // Resolve TM-vs-HM from the now fully-populated per-move map; the kind
        // captured during the concurrent batch can be stale (see race above).
        const kind = machineKindBySlug.get(slug)?.[vg] ?? e.machine.kind;
        out.machine = { kind, ids: e.machine.ids.sort((a, b) => a - b) };
      }
      if (e.tutor) out.tutor = e.tutor.sort((a, b) => a - b);
      sorted[slug] = out;
    }
    await writeFile(path.join(tmCompatDir, `${vg}.json`), JSON.stringify(sorted) + "\n", "utf-8");
    console.log(`tm-compat/${vg}.json: ${Object.keys(sorted).length} moves`);
  }

  const moves = {};
  for (const slug of [...moveCache.keys()].sort()) moves[slug] = moveCache.get(slug);
  await writeFile(path.join(dataDir, "moves.json"), JSON.stringify(moves) + "\n", "utf-8");
  console.log(`moves.json: ${Object.keys(moves).length} moves`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
