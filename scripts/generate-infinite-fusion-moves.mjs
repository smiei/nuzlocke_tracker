// Generates Infinite Fusion's move data - the three files every other pack
// gets from scripts/generate-learnsets.mjs, but read from the game itself
// instead of PokeAPI, because its movepools are its own:
//
//   data/movesets/infinite-fusion.json   { ourId: [[level, slug], ...] }
//   data/learnsets/infinite-fusion.json  { ourId: { damagingType: minLevel } }
//   data/tm-compat/infinite-fusion.json  { slug: { machine?:{kind,ids}, tutor?:ids } }
//
// Sources (downloaded on demand, no clone needed - see CLAUDE.md's "Reading
// the game's own data"): Data/species.dat (@moves = level-up list,
// @tutor_moves = everything teachable by TM/HM/tutor), Data/moves.dat (type,
// category, power, accuracy, PP, description) and Data/items.dat (the 122 TM
// and 10 HM items, each carrying its move - that is what tells a TM from a
// tutor move, which species.dat alone cannot).
//
// data/moves.json is SHARED with every other pack, so this script only ADDS
// moves it doesn't have yet (74 of the game's 611, all real Gen 6/7 moves) and
// never rewrites an existing entry. Those additions come from PokeAPI, for the
// localized names and the generation-accurate past values the rest of the app
// expects; a move PokeAPI doesn't know at all (an Infinite Fusion invention)
// falls back to the game's own English name and stats.
//
// Run manually: node scripts/generate-infinite-fusion-moves.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "@hyrious/marshal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const RAW = "https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/HEAD";
const VERSION_GROUP = "infinite-fusion";
const MAPPING_PACK = "infinite-fusion-classic";
const LANGS = ["de", "en", "fr", "es", "it"];

// The game's category field: 0 physical, 1 special, 2 status.
const DAMAGE_CLASS = ["physical", "special", "status"];

// Symbols whose normalized form doesn't match PokeAPI's slug. TRIATTACK2 is
// an internal second entry for Tri Attack, not a move of its own.
const MOVE_ALIASES = { HIJUMPKICK: "high-jump-kick", TRIATTACK2: "tri-attack" };

const ivar = (object, name) => object[Symbol.for("@" + name)];
const symbolName = (value) => (typeof value === "symbol" ? Symbol.keyFor(value) : value);
const text = (value) => (value instanceof Uint8Array ? new TextDecoder().decode(value) : value);
const normalize = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function readLocalJson(...segments) {
  return JSON.parse(await readFile(path.join(dataDir, ...segments), "utf-8"));
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

// version-group name -> generation, for PokeAPI's past_values/flavor text -
// same conversion generate-learnsets.mjs does.
async function loadVersionGroupGenerations() {
  const list = await fetchJson("https://pokeapi.co/api/v2/version-group?limit=200");
  const map = new Map();
  for (let i = 0; i < list.results.length; i += 8) {
    await Promise.all(
      list.results.slice(i, i + 8).map(async (entry) => {
        const detail = await fetchJson(entry.url);
        map.set(detail.name, ROMAN[detail.generation.name.replace("generation-", "")] ?? 99);
      }),
    );
  }
  return map;
}

const CUT_MOVE_PLACEHOLDER = /can.?t be used/i;

function buildPastValues(move, vgGenerations) {
  const out = [];
  for (const pv of move.past_values ?? []) {
    const gen = vgGenerations.get(pv.version_group?.name);
    if (!gen || gen > 90) continue;
    const entry = { maxGeneration: gen - 1 };
    if (pv.power != null) entry.power = pv.power;
    if (pv.accuracy != null) entry.accuracy = pv.accuracy;
    if (pv.pp != null) entry.pp = pv.pp;
    if (pv.effect_chance != null) entry.effectChance = pv.effect_chance;
    if (Object.keys(entry).length > 1) out.push(entry);
  }
  return out.sort((a, b) => a.maxGeneration - b.maxGeneration);
}

function buildFlavor(move, vgGenerations) {
  const entries = move.flavor_text_entries ?? [];
  const cutVersionGroups = new Set(
    entries
      .filter((e) => e.language?.name === "en" && CUT_MOVE_PLACEHOLDER.test(e.flavor_text ?? ""))
      .map((e) => e.version_group?.name),
  );
  const flavor = {};
  for (const lang of LANGS) {
    const usable = entries.filter(
      (e) => e.language?.name === lang && !cutVersionGroups.has(e.version_group?.name),
    );
    if (usable.length === 0) continue;
    let best = usable[usable.length - 1];
    let bestGen = -1;
    for (const e of usable) {
      const gen = vgGenerations.get(e.version_group?.name) ?? -1;
      if (gen >= bestGen) {
        bestGen = gen;
        best = e;
      }
    }
    const value = best.flavor_text?.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
    if (value) flavor[lang] = value;
  }
  return flavor;
}

// A move PokeAPI has no entry for: everything this app shows, taken from the
// game's own table. The English name stands in for every language, exactly
// like the pack's Pokémon names do (the game is English-only).
function moveInfoFromGame(gameMove) {
  const name = text(ivar(gameMove, "real_name"));
  const category = ivar(gameMove, "category");
  const power = ivar(gameMove, "base_damage");
  const accuracy = ivar(gameMove, "accuracy");
  const effectChance = ivar(gameMove, "effect_chance");
  const description = text(ivar(gameMove, "real_description"));
  return {
    type: symbolName(ivar(gameMove, "type")).toLowerCase(),
    damaging: category !== 2,
    damageClass: DAMAGE_CLASS[category] ?? "status",
    power: power > 0 ? power : null,
    accuracy: accuracy > 0 ? accuracy : null,
    pp: ivar(gameMove, "total_pp") ?? null,
    effectChance: effectChance > 0 ? effectChance : null,
    names: Object.fromEntries(LANGS.map((lang) => [lang, name])),
    ...(description ? { flavor: Object.fromEntries(LANGS.map((lang) => [lang, description])) } : {}),
  };
}

async function main() {
  const [speciesDat, movesDat, itemsDat, version] = await Promise.all([
    download(`${RAW}/Data/species.dat`),
    download(`${RAW}/Data/moves.dat`),
    download(`${RAW}/Data/items.dat`),
    download(`${RAW}/Data/VERSION`).then((buffer) => buffer.toString("utf-8").trim()),
  ]);
  const gameSpecies = Object.values(load(speciesDat));
  const gameMoves = new Map(
    Object.values(load(movesDat)).map((move) => [symbolName(ivar(move, "id")), move]),
  );
  const machineItems = Object.values(load(itemsDat)).filter((item) => ivar(item, "move"));

  const mapping = await readLocalJson("games", MAPPING_PACK, "species.json");
  const ourIdByIfId = new Map(mapping.map((entry) => [entry.ifId, entry.ourId]));
  const moves = await readLocalJson("moves.json");

  // Every move the game actually uses, level-up and teachable alike.
  const usedSymbols = new Set();
  for (const species of gameSpecies) {
    if (ivar(species, "form") > 0) continue;
    for (const [, move] of ivar(species, "moves") ?? []) usedSymbols.add(symbolName(move));
    for (const move of ivar(species, "tutor_moves") ?? []) usedSymbols.add(symbolName(move));
  }
  for (const item of machineItems) usedSymbols.add(symbolName(ivar(item, "move")));

  // Symbol -> this app's move slug: what moves.json already has, then
  // PokeAPI's full move list, then the alias table, then the game's own name.
  const slugByNormalized = new Map(Object.keys(moves).map((slug) => [normalize(slug), slug]));
  const pokeApiMoves = await fetchJson("https://pokeapi.co/api/v2/move?limit=2000");
  const pokeApiByNormalized = new Map(
    pokeApiMoves.results.map((entry) => [normalize(entry.name), entry.name]),
  );
  const slugBySymbol = new Map();
  const missingSlugs = new Map(); // slug -> PokeAPI url | null (game-only move)
  for (const symbol of usedSymbols) {
    const known = slugByNormalized.get(symbol);
    if (known) {
      slugBySymbol.set(symbol, known);
      continue;
    }
    const aliased = MOVE_ALIASES[symbol];
    const fromApi = aliased ?? pokeApiByNormalized.get(symbol);
    if (fromApi) {
      slugBySymbol.set(symbol, fromApi);
      if (!moves[fromApi]) {
        missingSlugs.set(
          fromApi,
          pokeApiMoves.results.find((entry) => entry.name === fromApi)?.url ?? null,
        );
      }
      continue;
    }
    // The game's own invention: slugify its name and take its data below.
    const gameMove = gameMoves.get(symbol);
    const slug = gameMove
      ? text(ivar(gameMove, "real_name")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : symbol.toLowerCase();
    slugBySymbol.set(symbol, slug);
    if (!moves[slug]) missingSlugs.set(slug, null);
  }

  // Fill data/moves.json for everything it doesn't know yet - never touching
  // an entry another pack already relies on.
  let addedFromApi = 0;
  let addedFromGame = 0;
  if (missingSlugs.size > 0) {
    const vgGenerations = await loadVersionGroupGenerations();
    const symbolBySlug = new Map([...slugBySymbol].map(([symbol, slug]) => [slug, symbol]));
    for (const [slug, url] of missingSlugs) {
      if (url) {
        const move = await fetchJson(url);
        const names = {};
        for (const lang of LANGS) {
          const hit = move.names.find((n) => n.language?.name === lang);
          names[lang] =
            hit?.name ?? move.names.find((n) => n.language?.name === "en")?.name ?? slug;
        }
        const past = buildPastValues(move, vgGenerations);
        const flavor = buildFlavor(move, vgGenerations);
        moves[slug] = {
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
        };
        addedFromApi++;
      } else {
        const gameMove = gameMoves.get(symbolBySlug.get(slug));
        if (!gameMove) continue;
        moves[slug] = moveInfoFromGame(gameMove);
        addedFromGame++;
      }
    }
  }

  // The game's TM/HM items are what separates a machine move from a tutor
  // move; species.dat lumps both into @tutor_moves.
  const machineKindBySlug = new Map();
  for (const item of machineItems) {
    const id = symbolName(ivar(item, "id"));
    const slug = slugBySymbol.get(symbolName(ivar(item, "move")));
    if (slug) machineKindBySlug.set(slug, id.startsWith("HM") ? "hm" : "tm");
  }

  const movesets = {};
  const learnsets = {};
  const tmCompat = {};
  let speciesCount = 0;
  for (const species of gameSpecies) {
    if (ivar(species, "form") > 0) continue;
    const ourId = ourIdByIfId.get(ivar(species, "id_number"));
    if (ourId === undefined) continue;
    speciesCount++;

    const levelMoves = new Map(); // slug -> lowest level
    for (const [level, move] of ivar(species, "moves") ?? []) {
      const slug = slugBySymbol.get(symbolName(move));
      if (!slug) continue;
      levelMoves.set(slug, Math.min(levelMoves.get(slug) ?? Infinity, level || 1));
    }
    if (levelMoves.size > 0) {
      movesets[ourId] = [...levelMoves]
        .map(([slug, level]) => [level, slug])
        .sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])));
      // Damaging attack types, from the game's own move table rather than
      // PokeAPI's current one - this pack's types are the game's.
      const byType = {};
      for (const [slug, level] of levelMoves) {
        const gameMove = gameMoves.get(
          [...slugBySymbol].find(([, value]) => value === slug)?.[0] ?? "",
        );
        const info = moves[slug];
        const damaging = gameMove ? ivar(gameMove, "category") !== 2 : (info?.damaging ?? false);
        if (!damaging) continue;
        const type = gameMove
          ? symbolName(ivar(gameMove, "type")).toLowerCase()
          : (info?.type ?? "normal");
        byType[type] = Math.min(byType[type] ?? Infinity, level);
      }
      if (Object.keys(byType).length > 0) {
        learnsets[ourId] = Object.fromEntries(Object.entries(byType).sort((a, b) => a[1] - b[1]));
      }
    }

    for (const move of ivar(species, "tutor_moves") ?? []) {
      const slug = slugBySymbol.get(symbolName(move));
      if (!slug) continue;
      const entry = (tmCompat[slug] ??= {});
      const kind = machineKindBySlug.get(slug);
      if (kind) (entry.machine ??= { kind, ids: [] }).ids.push(ourId);
      else (entry.tutor ??= []).push(ourId);
    }
  }

  const sortedMovesets = {};
  for (const id of Object.keys(movesets).map(Number).sort((a, b) => a - b)) sortedMovesets[id] = movesets[id];
  const sortedLearnsets = {};
  for (const id of Object.keys(learnsets).map(Number).sort((a, b) => a - b)) sortedLearnsets[id] = learnsets[id];
  const sortedTmCompat = {};
  for (const slug of Object.keys(tmCompat).sort()) {
    const entry = tmCompat[slug];
    const out = {};
    if (entry.machine) out.machine = { kind: entry.machine.kind, ids: entry.machine.ids.sort((a, b) => a - b) };
    if (entry.tutor) out.tutor = entry.tutor.sort((a, b) => a - b);
    sortedTmCompat[slug] = out;
  }

  await mkdir(path.join(dataDir, "movesets"), { recursive: true });
  await mkdir(path.join(dataDir, "learnsets"), { recursive: true });
  await mkdir(path.join(dataDir, "tm-compat"), { recursive: true });
  await writeFile(
    path.join(dataDir, "movesets", `${VERSION_GROUP}.json`),
    JSON.stringify(sortedMovesets) + "\n",
    "utf-8",
  );
  await writeFile(
    path.join(dataDir, "learnsets", `${VERSION_GROUP}.json`),
    JSON.stringify(sortedLearnsets) + "\n",
    "utf-8",
  );
  await writeFile(
    path.join(dataDir, "tm-compat", `${VERSION_GROUP}.json`),
    JSON.stringify(sortedTmCompat) + "\n",
    "utf-8",
  );
  const sortedMoves = {};
  for (const slug of Object.keys(moves).sort()) sortedMoves[slug] = moves[slug];
  await writeFile(path.join(dataDir, "moves.json"), JSON.stringify(sortedMoves) + "\n", "utf-8");

  const machineMoves = Object.values(sortedTmCompat).filter((entry) => entry.machine).length;
  console.log(`game version ${version}: ${speciesCount} species mapped`);
  console.log(`movesets/${VERSION_GROUP}.json: ${Object.keys(sortedMovesets).length} Pokémon`);
  console.log(`learnsets/${VERSION_GROUP}.json: ${Object.keys(sortedLearnsets).length} Pokémon`);
  console.log(
    `tm-compat/${VERSION_GROUP}.json: ${Object.keys(sortedTmCompat).length} moves (${machineMoves} by TM/HM)`,
  );
  console.log(
    `moves.json: ${Object.keys(sortedMoves).length} moves (+${addedFromApi} from PokeAPI, +${addedFromGame} from the game's own table)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
