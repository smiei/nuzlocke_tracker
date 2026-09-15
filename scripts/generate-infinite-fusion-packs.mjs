// Builds data/games/infinite-fusion-classic/ and .../infinite-fusion-remix/
// from a local clone of github.com/fbosch/infinite-fusion-nuzlocke (MIT) -
// see CLAUDE.md's Infinite Fusion section and the plan this implements
// (Phase 1, step 6). The clone is gitignored and only ever a one-time data
// SOURCE, never a runtime dependency: this script reads it once and writes
// plain JSON into data/games/, exactly like every other generate-*.mjs.
//
// Run manually: node scripts/generate-infinite-fusion-packs.mjs
// Requires the reference repo cloned at ../fboschinfinite-fusion-nuzlocke
// relative to the project root (see .gitignore).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REF = path.join(
  ROOT,
  "fboschinfinite-fusion-nuzlocke",
  "infinite-fusion-nuzlocke-master",
);
const GAMES_DIR = path.join(ROOT, "data", "games");

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf-8"));
}

// ---------------------------------------------------------------------------
// Species mapping: Infinite Fusion's own dex id -> this app's pokemon.json
// id. Almost always the national dex id (data/pokemon.json now covers up to
// #800, backfilled specifically for this pack - see CLAUDE.md). The six
// exceptions below are species IF splits into multiple catchable dex slots
// that this app already models as alternate FORMES (generate-forms.mjs's
// EXTRA_FORMS allowlist added the four that didn't already exist): each
// group's non-default IF entries must map to the forme id, not the species
// id, or half the group would collide on one ourId. Verified against the
// reference repo's own duplicate-nationalDexId entries (six groups, checked
// by hand against PokeAPI's variety names) - see the comment on each line.
// ---------------------------------------------------------------------------
const FORME_OVERRIDES = {
  // Oricorio: Baile (IF's default/lowest id in the group) keeps the species
  // id; the other three dance styles are generate-forms.mjs's new formes.
  "Oricorio Pom-Pom Style": 10123,
  "Oricorio Pa'u Style": 10124,
  "Oricorio Sensu Style": 10125,
  // Lycanroc: only Midnight is a separate IF entry (Dusk is not in IF's dex).
  "Lycanroc Midnight Form": 10126,
  // Meloetta: Pirouette already existed as a forme before this pack existed.
  "Meloetta Pirouette Form": 10018,
  // Necrozma: only Ultra is a separate IF entry (Dusk Mane/Dawn Wings, the
  // fusion-with-Solgaleo/Lunala formes, are not in IF's dex).
  "Necrozma Ultra": 10157,
  // Minior: every colour within a shield state is stat/type-identical (see
  // generate-forms.mjs's comment) - Core has exactly one forme representing
  // all seven colours.
  "Minior Core Form": 10136,
  // Castform: all three weather formes already existed before this pack.
  "Castform Sunny": 10013,
  "Castform Rainy": 10014,
  "Castform Snowy": 10015,
};

async function buildSpeciesList() {
  const refPokemon = await readJson(path.join(REF, "data", "shared", "pokemon-data.json"));
  const ourPokemon = await readJson(path.join(ROOT, "data", "pokemon.json"));
  const ourIds = new Set(ourPokemon.map((p) => p.id));

  const entries = [];
  const missing = [];
  for (const p of refPokemon) {
    const ourId = FORME_OVERRIDES[p.name] ?? p.nationalDexId;
    if (!ourIds.has(ourId)) {
      missing.push({ ifId: p.id, name: p.name, nationalDexId: p.nationalDexId, triedOurId: ourId });
      continue;
    }
    entries.push({ ifId: p.id, ourId });
  }
  entries.sort((a, b) => a.ifId - b.ifId);

  if (missing.length > 0) {
    console.warn(`species: ${missing.length} entries have no matching pokemon.json id:`);
    for (const m of missing) console.warn(`  IF #${m.ifId} ${m.name} (national dex ${m.nationalDexId})`);
  }
  console.log(`species: ${entries.length}/${refPokemon.length} mapped`);
  return entries;
}

// ---------------------------------------------------------------------------
// Routes: one entry per location's wild encounters ("route"), plus one entry
// per (location, category) static-like encounter (statics/gifts/trades/
// quests -> "static", suffixed by category) so a location offering more than
// one of these - e.g. both a static AND a trade - keeps them as separate
// trackable slots rather than silently merging two different catches into
// one. See CLAUDE.md's Infinite Fusion section for the full reasoning.
//
// Order: data/shared/locations.json's own order first (Kanto+Johto's curated
// "main" list; it starts with "Starter", matching every other pack's route
// #1), then anything the encounter tables reference that ISN'T in that list,
// in first-appearance order across the source files. locations.json turned
// out to cover under half of what's actually referenced (Sevii/Orange-island
// content, Pinkan Island, P2 Laboratory, the several Safari Zone areas, ...)
// - all real content, kept. EXCLUDED_LOCATIONS is the one confirmed
// exception found by inspecting its own encounter table.
// ---------------------------------------------------------------------------

const EXCLUDED_LOCATIONS = new Set([
  // Single-species (Ditto only) developer test room, not real content.
  "Debug Island",
]);

async function loadJsonOrEmpty(p) {
  return existsSync(p) ? readJson(p) : [];
}

async function buildRoutesForPack(mode, existingRoutes) {
  const dataDir = path.join(REF, "data");
  const locations = await readJson(path.join(dataDir, "shared", "locations.json"));
  const locationIdByName = new Map(locations.map((l) => [l.name, l.id]));

  const encounters = await loadJsonOrEmpty(path.join(dataDir, mode, "encounters.json"));
  const safari = await loadJsonOrEmpty(path.join(dataDir, mode, "safari-encounters.json"));
  const statics = await loadJsonOrEmpty(path.join(dataDir, mode, "statics.json"));
  const gifts = await loadJsonOrEmpty(path.join(dataDir, mode, "gifts.json"));
  const trades = await loadJsonOrEmpty(path.join(dataDir, mode, "trades.json"));
  const quests = await loadJsonOrEmpty(path.join(dataDir, mode, "quests.json"));

  const wildRouteNames = new Set([...encounters, ...safari].map((e) => e.routeName));

  // The starter pick isn't in any per-location category file - it's a flat
  // {classic:[...], remix:[...]} species list in starter-pokemon.json, tied
  // to the "Starter" location by name alone (same convention every other
  // pack here already uses - see data/games/firered/routes.json's id 1).
  const starters = await loadJsonOrEmpty(path.join(dataDir, "shared", "starter-pokemon.json"));
  const hasStarterCategory = Array.isArray(starters[mode]) && starters[mode].length > 0;

  const staticCategoriesByLocation = new Map();
  const addStatic = (list, label) => {
    for (const entry of list) {
      const arr = staticCategoriesByLocation.get(entry.routeName) ?? [];
      arr.push(label);
      staticCategoriesByLocation.set(entry.routeName, arr);
    }
  };
  addStatic(statics, "Static");
  addStatic(gifts, "Gift");
  addStatic(trades, "Trade");
  addStatic(quests, "Quest");

  const orderedNames = [];
  const seenNames = new Set();
  const pushName = (name) => {
    if (seenNames.has(name) || EXCLUDED_LOCATIONS.has(name)) return;
    seenNames.add(name);
    orderedNames.push(name);
  };
  for (const loc of locations) pushName(loc.name);
  for (const list of [encounters, safari, statics, gifts, trades, quests]) {
    for (const e of list) pushName(e.routeName);
  }

  // Preserve ids across re-runs: match by sourceId (locations.json's own
  // uuid, or a derived "<uuid>:<category>" for a static-type entry) first,
  // falling back to an exact (name, type) match - see the file header.
  // Never renumbers; brand new entries get fresh ids above the current max.
  const existingBySourceId = new Map(
    (existingRoutes ?? []).filter((r) => r.sourceId).map((r) => [r.sourceId, r]),
  );
  const existingByNameType = new Map(
    (existingRoutes ?? []).map((r) => [`${r.names.en} ${r.type}`, r]),
  );
  let nextId = Math.max(0, ...(existingRoutes ?? []).map((r) => r.id)) + 1;
  const usedExisting = new Set();

  function claim(name, type, sourceId) {
    const hit = (sourceId && existingBySourceId.get(sourceId)) ?? existingByNameType.get(`${name} ${type}`);
    if (hit) {
      usedExisting.add(hit.id);
      return hit.id;
    }
    return nextId++;
  }

  const routes = [];
  for (const name of orderedNames) {
    const sourceId = locationIdByName.get(name);
    if (wildRouteNames.has(name)) {
      const id = claim(name, "route", sourceId);
      routes.push({
        id,
        names: { de: name, en: name, fr: name, es: name, it: name },
        type: "route",
        ...(sourceId ? { sourceId } : {}),
      });
    }
    if (name === "Starter" && hasStarterCategory) {
      const id = claim("Starter", "static", sourceId);
      routes.push({
        id,
        // All five keys are the same English string, not a real translation -
        // this pack forces English everywhere via game.json's nameLang, but
        // that only rewrites POKEMON names at read time (see gameData.ts);
        // route/levelcap names have no such override; and are authored
        // English-only here directly, matching every other route below.
        names: { de: "Starter", en: "Starter", fr: "Starter", es: "Starter", it: "Starter" },
        type: "static",
        ...(sourceId ? { sourceId } : {}),
      });
    }
    const categories = staticCategoriesByLocation.get(name);
    if (categories) {
      for (const label of categories) {
        const staticName = `${name} (${label})`;
        const staticSourceId = sourceId ? `${sourceId}:${label}` : undefined;
        const id = claim(staticName, "static", staticSourceId);
        routes.push({
          id,
          names: { de: staticName, en: staticName, fr: staticName, es: staticName, it: staticName },
          type: "static",
          ...(staticSourceId ? { sourceId: staticSourceId } : {}),
        });
      }
    }
  }

  const orphaned = (existingRoutes ?? []).filter((r) => !usedExisting.has(r.id));
  if (orphaned.length > 0) {
    console.warn(
      `${mode}: ${orphaned.length} existing route id(s) no longer match fresh source data - ` +
        `KEEPING them unchanged (backups/encounters may still reference them):`,
    );
    for (const r of orphaned) console.warn(`  #${r.id} ${r.names.en} (${r.type})`);
    routes.push(...orphaned);
  }

  return { routes, counts: { locations: locations.length, encounters: encounters.length, safari: safari.length, statics: statics.length, gifts: gifts.length, trades: trades.length, quests: quests.length } };
}

async function main() {
  if (!existsSync(REF)) {
    console.error(`Reference clone not found at ${REF} - see .gitignore.`);
    process.exitCode = 1;
    return;
  }

  const species = await buildSpeciesList();

  const PACKS = [
    { gameId: "infinite-fusion-classic", mode: "classic" },
    { gameId: "infinite-fusion-remix", mode: "remix" },
  ];

  for (const { gameId, mode } of PACKS) {
    const dir = path.join(GAMES_DIR, gameId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "species.json"), JSON.stringify(species, null, 2) + "\n");

    const routesPath = path.join(dir, "routes.json");
    const existingRoutes = existsSync(routesPath) ? await readJson(routesPath) : null;
    const { routes, counts } = await buildRoutesForPack(mode, existingRoutes);
    await writeFile(routesPath, JSON.stringify(routes, null, 2) + "\n");
    console.log(
      `${gameId}: wrote ${routes.length} routes ` +
        `(sources: ${counts.locations} locations, ${counts.encounters} encounters, ${counts.safari} safari, ` +
        `${counts.statics} statics, ${counts.gifts} gifts, ${counts.trades} trades, ${counts.quests} quests)`,
    );
  }
  console.log("wrote species.json + routes.json to both packs");
}

main();
