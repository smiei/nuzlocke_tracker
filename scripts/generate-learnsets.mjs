// Generates level-up move data for every version group a game pack references
// (game.json `versionGroup`), in three shapes:
//
//  data/learnsets/<vg>.json  { id: { type: minLevel } }   DAMAGING types only
//      -> the "Kampf" tab's offensive coverage + team matchup.
//  data/movesets/<vg>.json   { id: [[level, slug], ...] }  ALL level-up moves
//      -> the Pokédex info card's move list + the self-destruct/explosion warn.
//  data/moves.json           { slug: { names, type, damaging, power, ... } }
//      -> localized move names/flavor text + type + battle stats, shared
//         across games (see the per-move shape below).
//  data/tm-compat/<vg>.json  { slug: { machine?:{kind,ids}, tutor?:ids } }
//      -> the TM/HM/tutor tab: which Pokémon can OFFICIALLY learn a move via
//         machine (kind = "tm"|"hm") or a move tutor, per version group.
//
// PokeAPI reports each move's CURRENT (latest-generation) power/accuracy/pp/
// effect chance, and its `past_values` list what a field used to be. Those
// entries are keyed by the version group in which the change TOOK EFFECT, so
// the listed value applied through the generation BEFORE it - converted here
// into `past: [{ maxGeneration, power?, accuracy?, pp?, effectChance? }]`
// (value applied through that generation, inclusive), matching the
// maxGeneration convention data/move-type-history.json already uses. This
// matters: roughly a fifth of moves had different numbers in Gen 3 (Thunder
// 120->110, Rapid Spin 20->50, Pin Missile 14/85->25/95, ...). Resolved per
// field at render time by moveStatsForGeneration() in src/lib/learnset.ts.
// `past_values[].type` is deliberately NOT used - historical retypes stay
// hand-curated in data/move-type-history.json, one source of truth.
//
// `damageClass` is likewise PokeAPI's Gen-4+ view and is only correct from
// Gen 4 on: before the physical/special split, the category followed the
// move's TYPE, not the move (Gen 3 Bite = special, Gust/Shadow Ball =
// physical). damageClassForGeneration() in src/lib/learnset.ts applies that
// rule at render time; "status" itself is stable across all generations.
//
// `flavor` is the localized in-game description (all 5 UI languages). The
// mechanically precise effect_entries exist in English/French only, and the
// German flavor text only goes back to Gen 6, so this is deliberately the
// modern wording - the numbers above are what carry the generation accuracy.
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

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

// version-group name -> generation number, for turning PokeAPI's
// past_values[].version_group into our maxGeneration convention.
async function loadVersionGroupGenerations() {
  const list = await fetchJson("https://pokeapi.co/api/v2/version-group?limit=200");
  const map = new Map();
  const batch = 8;
  for (let i = 0; i < list.results.length; i += batch) {
    await Promise.all(
      list.results.slice(i, i + batch).map(async (r) => {
        const d = await fetchJson(r.url);
        map.set(d.name, ROMAN[d.generation.name.replace("generation-", "")] ?? 99);
      }),
    );
  }
  return map;
}

// PokeAPI past_values -> [{ maxGeneration, power?, accuracy?, pp?,
// effectChance? }], sorted oldest-first. A null field means "unchanged at
// that point", so it's simply omitted and resolution falls through to the
// next entry (or the current value) - see the header comment.
function buildPastValues(move, vgGenerations) {
  const out = [];
  for (const pv of move.past_values ?? []) {
    const gen = vgGenerations.get(pv.version_group?.name);
    if (!gen || gen > 90) continue;
    // The change took effect IN that version group, so the old value applied
    // through the generation before it.
    const entry = { maxGeneration: gen - 1 };
    if (pv.power != null) entry.power = pv.power;
    if (pv.accuracy != null) entry.accuracy = pv.accuracy;
    if (pv.pp != null) entry.pp = pv.pp;
    if (pv.effect_chance != null) entry.effectChance = pv.effect_chance;
    if (Object.keys(entry).length > 1) out.push(entry);
  }
  return out.sort((a, b) => a.maxGeneration - b.maxGeneration);
}

// Localized in-game description: the most recent wording available per
// language (German only goes back to Gen 6, so there is nothing older to
// prefer). Newlines are soft-wrap artifacts of the games' text boxes.
function buildFlavor(move, vgGenerations) {
  const flavor = {};
  for (const lang of LANGS) {
    const entries = (move.flavor_text_entries ?? []).filter((e) => e.language?.name === lang);
    if (entries.length === 0) continue;
    let best = entries[entries.length - 1];
    let bestGen = -1;
    for (const e of entries) {
      const gen = vgGenerations.get(e.version_group?.name) ?? -1;
      if (gen >= bestGen) {
        bestGen = gen;
        best = e;
      }
    }
    const text = best.flavor_text?.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
    if (text) flavor[lang] = text;
  }
  return flavor;
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
  const vgGenerations = await loadVersionGroupGenerations();

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
            const rawVg = v.version_group.name;
            // Known PokeAPI gap: Deoxys (386) is only tagged "ruby-sapphire"
            // for its Gen 3 moves, never "emerald"/"firered-leafgreen" - even
            // though the in-game Gen 3 movepool is identical across all
            // three. Mirror ruby-sapphire onto both so it doesn't silently
            // end up with an empty moveset again.
            const effectiveVgs =
              pid === 386 && rawVg === "ruby-sapphire"
                ? ["emerald", "firered-leafgreen"]
                : [rawVg];
            for (const vg of effectiveVgs) {
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
            const past = buildPastValues(move, vgGenerations);
            const flavor = buildFlavor(move, vgGenerations);
            moveCache.set(slug, {
              type: move.type.name,
              damaging: move.damage_class?.name !== "status",
              damageClass: move.damage_class?.name ?? "status",
              power: move.power ?? null,
              accuracy: move.accuracy ?? null,
              pp: move.pp ?? null,
              effectChance: move.effect_chance ?? null,
              names,
              ...(Object.keys(flavor).length > 0 && { flavor }),
              ...(past.length > 0 && { past }),
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
