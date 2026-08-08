import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Lang } from "@/lib/i18n/dictionary";
import type { LocalizedNames } from "@/lib/i18n/localize";
import type {
  Learnset,
  MoveInfo,
  Moveset,
  MovesTable,
  MoveTypeHistoryEntry,
  TmCompatTable,
} from "@/lib/learnset";

// Static reference data lives in /data as JSON, not in the DB (see project spec).
// Read fresh from disk on every call (no in-memory caching) so the bind-mounted
// files in Docker can be edited without rebuilding or restarting the container.
//
// Layout: game-independent data (pokemon, evolutions, effectiveness,
// catchrates) sits in /data directly; everything tied to one playthrough's
// world (routes, levelcaps, evolution-overrides) lives in a game pack under
// /data/games/<gameId>/ next to its game.json metadata. Which pack a run
// uses is Run.gameId.
const DATA_DIR = path.join(process.cwd(), "data");
const GAMES_DIR = path.join(DATA_DIR, "games");

export const DEFAULT_GAME_ID = "firered";

export type GameInfo = {
  id: string;
  // Display order in the game picker.
  sort: number;
  generation: number;
  // Highest national-dex id obtainable in this game - filters the pick
  // lists, evolution targets, and per-run rankings.
  dexLimit: number;
  // Sprite folder under public/pokemon-sprites/ (see scripts/download-sprites.mjs).
  spriteSet: string;
  // PokeAPI version group for level-up learnsets (data/learnsets/<vg>.json).
  versionGroup: string;
  // Optional folder under public/trainers/ for game-specific trainer avatars,
  // so a generic name like "Rivale" can differ per game (Emerald's rival isn't
  // Platinum's). Missing files fall back to the flat public/trainers/ root, so
  // trainers shared across games (e.g. Brock) need only one file there. Games
  // with identical trainers (HeartGold/SoulSilver) point at the same set.
  // Defaults to the game id when absent.
  trainerSet?: string;
  names: LocalizedNames;
};

// "route" = normal wild encounter; "static" = fixed encounter (NPC gift,
// purchase, fossil, Snorlax, legendaries). Statics are exempt from the
// Species Clause and need no manual flag in the UI.
export type RouteType = "route" | "static";

export type Route = {
  id: number;
  // Localized display names (de/en curated, rest generated - see
  // scripts/generate-names.mjs and localizeName()).
  names: LocalizedNames;
  type: RouteType;
  // Only reachable after the Elite Four (Sevii Islands 4-7, Cerulean Cave).
  // The Encounter tab collapses these behind a "post-game" toggle by default.
  postgame?: boolean;
};

export type PokemonStats = {
  KP: number;
  "Ang.": number;
  "Vert.": number;
  "Sp.-A.": number;
  "Sp.-V.": number;
  "Init.": number;
  Summe: number;
};

export type Pokemon = {
  id: number;
  names: LocalizedNames;
  types: string[];
  family_id: number;
  stats: PokemonStats;
  // Legendary OR mythical (PokeAPI's is_legendary/is_mythical combined into
  // one flag - the Pokédex tab's filter doesn't distinguish the two).
  legendary: boolean;
  // Kilograms, backfilled by scripts/generate-weights.mjs. Optional because
  // it's displayed verbatim: a live-edited pokemon.json missing the field
  // should drop the row, not render "undefined kg".
  weight?: number;
  // Set ONLY on alternate-forme entries (Deoxys Attack, Wash Rotom, ...):
  // the species this is a forme of. Their ids start at 10001, so
  // getPokemonList(dexLimit) keeps them out of the Pokédex and the encounter
  // pickers automatically. See scripts/generate-forms.mjs.
  baseId?: number;
  // Localized forme label ("Angriffsform"). Present on formes AND on the base
  // entry of any species that has them, so a picker can offer the way back.
  formNames?: LocalizedNames;
};

export type LevelCap = {
  id: number;
  names: LocalizedNames;
  location: LocalizedNames;
  badge: LocalizedNames | null;
  // null for fights without a level cap (rival / Team Rocket boss battles).
  max_level: number | null;
  // Optional sprite-file override (German slug) when it differs from the
  // canonical German name, e.g. the rival reuses the champion's sprite.
  sprite?: string;
};

// Parsed once per request, not once per call. The files are still re-read on
// the NEXT request, so the bind-mounted /data stays live-editable exactly as
// before - this only stops a single page render from parsing the same file
// over and over. That mattered: getPokemonById() goes through the full list,
// and pages call it (and getEvolutionById) once per encounter, so rendering
// the Team tab re-parsed pokemon.json (214 KB) and evolutions.json hundreds
// of times and took seconds.
//
// Safe to share the parsed objects because every consumer treats them as
// read-only (map/filter/find); nothing mutates them in place.
const parseFileCached = cache((absolutePath: string): unknown =>
  JSON.parse(fs.readFileSync(absolutePath, "utf-8")),
);

function readJson<T>(filename: string): T {
  return parseFileCached(path.join(DATA_DIR, filename)) as T;
}

// Reads a file from a game pack, falling back to the default pack when the
// requested one doesn't have it - a run whose pack was removed from a
// live-edited /data keeps working instead of crashing every page.
function readGameJson<T>(gameId: string, filename: string): T {
  const primary = path.join(GAMES_DIR, gameId, filename);
  if (fs.existsSync(primary)) {
    return parseFileCached(primary) as T;
  }
  if (gameId !== DEFAULT_GAME_ID) {
    console.warn(`[data] missing ${filename} for game "${gameId}" - falling back to ${DEFAULT_GAME_ID}`);
    return readGameJson<T>(DEFAULT_GAME_ID, filename);
  }
  throw new Error(`Missing game data file: ${primary}`);
}

export function getGames(): GameInfo[] {
  return fs
    .readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(
      (entry) =>
        JSON.parse(
          fs.readFileSync(path.join(GAMES_DIR, entry.name, "game.json"), "utf-8"),
        ) as GameInfo,
    )
    .sort((a, b) => a.sort - b.sort);
}

export function getGameById(gameId: string): GameInfo | undefined {
  return getGames().find((game) => game.id === gameId);
}

// Never returns undefined - a run whose pack disappeared behaves like the
// default game instead of crashing every page.
export function getGameOrDefault(gameId: string): GameInfo {
  const game = getGameById(gameId) ?? getGameById(DEFAULT_GAME_ID);
  if (!game) throw new Error(`Missing default game pack "${DEFAULT_GAME_ID}"`);
  return game;
}

export function getRoutes(gameId: string): Route[] {
  return readGameJson<Route[]>(gameId, "routes.json");
}

export function getRouteById(gameId: string, routeId: number): Route | undefined {
  return getRoutes(gameId).find((route) => route.id === routeId);
}

// dexLimit (a game's highest obtainable national-dex id) filters the list;
// omitted = everything in the file.
export function getPokemonList(dexLimit?: number): Pokemon[] {
  const list = readJson<Pokemon[]>("pokemon.json");
  return dexLimit ? list.filter((pokemon) => pokemon.id <= dexLimit) : list;
}

// Deliberately searches the UNFILTERED list, so a currentPokemonId pointing
// at an alternate forme (id 10001+) still resolves.
export function getPokemonById(pokemonId: number): Pokemon | undefined {
  return getPokemonList().find((pokemon) => pokemon.id === pokemonId);
}

// Alternate formes whose base species is within this game's dex. Kept apart
// from getPokemonList() because a forme is a state a caught Pokémon can be
// switched INTO, never something the Pokédex lists or an encounter picks.
export function getPokemonForms(dexLimit?: number): Pokemon[] {
  return getPokemonList().filter(
    (pokemon) =>
      pokemon.baseId !== undefined && (dexLimit === undefined || pokemon.baseId <= dexLimit),
  );
}

export function getLevelCaps(gameId: string): LevelCap[] {
  return readGameJson<LevelCap[]>(gameId, "levelcaps.json");
}

// How a Pokémon evolves FROM its pre-evolution (rendered in the evolve
// dropdown). Generated from PokeAPI by scripts/generate-evolutions.mjs;
// ROM-specific changes live in data/evolution-overrides.json.
export type EvolutionMethod =
  | { kind: "level"; level: number }
  | { kind: "item"; item: string }
  | { kind: "happiness"; time?: string | null }
  // Level up while holding an item. Only produced by the time-based override
  // (the randomizer strips the "at night" half of e.g. Sneasel's evolution),
  // so vanilla data never uses it.
  | { kind: "levelHeld"; item: string }
  | { kind: "trade"; item?: string | null }
  | { kind: "beauty" }
  | { kind: "other" };

export type EvolutionEntry = {
  id: number;
  evolvesFrom: number | null;
  evolvesTo: number[];
  method?: EvolutionMethod | null;
};

type EvolutionOverride = {
  from: number;
  to: number;
  method: EvolutionMethod;
  // Mirrors PokeRandoZX: "impossible" = Change Impossible Evolutions (trade
  // & co. replaced), "easier" = Make Evolutions Easier (lowered levels),
  // "timeBased" = Remove Time-Based Evolutions (day/night conditions dropped,
  // Espeon/Umbreon become stone evolutions).
  // Missing = treated as "impossible" (the conservative default).
  category?: "impossible" | "easier" | "timeBased";
};

// Overrides are merged at read time (not baked into evolutions.json), so
// re-running the generator script never loses the ROM-specific changes and
// the override file stays editable in /data like everything else. Each game
// pack carries its own evolution-overrides.json (or none). The two per-run
// rule toggles select which override categories apply (both default on).
// Overrides only ever swap `method`, never the evolvesTo/evolvesFrom
// structure - so evolve/devolve validation is unaffected by the toggles.
export function getEvolutions(options?: {
  gameId?: string;
  impossible?: boolean;
  easier?: boolean;
  timeBased?: boolean;
}): EvolutionEntry[] {
  const entries = readJson<EvolutionEntry[]>("evolutions.json");
  const applyImpossible = options?.impossible ?? true;
  const applyEasier = options?.easier ?? true;
  const applyTimeBased = options?.timeBased ?? true;
  if (!applyImpossible && !applyEasier && !applyTimeBased) return entries;
  let overrides: EvolutionOverride[] = [];
  try {
    overrides = parseFileCached(
      path.join(GAMES_DIR, options?.gameId ?? DEFAULT_GAME_ID, "evolution-overrides.json"),
    ) as EvolutionOverride[];
  } catch {
    // No override file for this pack - vanilla methods apply.
  }
  const enabled: Record<string, boolean> = {
    impossible: applyImpossible,
    easier: applyEasier,
    timeBased: applyTimeBased,
  };
  overrides = overrides.filter((o) => enabled[o.category ?? "impossible"] ?? false);
  if (overrides.length === 0) return entries;

  const byKey = new Map(overrides.map((o) => [`${o.from}->${o.to}`, o.method]));
  return entries.map((entry) => {
    const method =
      entry.evolvesFrom !== null ? byKey.get(`${entry.evolvesFrom}->${entry.id}`) : undefined;
    return method ? { ...entry, method } : entry;
  });
}

export function getEvolutionById(
  pokemonId: number,
  options?: { gameId?: string; impossible?: boolean; easier?: boolean; timeBased?: boolean },
): EvolutionEntry | undefined {
  return getEvolutions(options).find((entry) => entry.id === pokemonId);
}

// Gen 1 has its own chart (no Dark/Steel, Ghost-vs-Psychic bug, Bug/Poison
// hitting each other super-effectively, Ice neutral vs Fire); gens 2-5 share
// the standard pre-Fairy chart in effectiveness.json.
export function getEffectiveness(generation = 3): EffectivenessTable {
  return readJson<EffectivenessTable>(
    generation === 1 ? "effectiveness-gen1.json" : "effectiveness.json",
  );
}

export type CatchRateEntry = {
  id: number;
  catch_rate: number;
};

// Base capture rates (1-255), fetched once from PokeAPI via
// scripts/download-catchrates.mjs so the Catchrate tab works offline.
export function getCatchRates(): CatchRateEntry[] {
  return readJson<CatchRateEntry[]>("catchrates.json");
}

// Per-version-group level-up learnsets, generated by
// scripts/generate-learnsets.mjs (type + helpers in src/lib/learnset.ts so
// client components can use them). Missing file -> {} (feature simply shows
// nothing rather than crashing).
export function getLearnset(versionGroup: string): Learnset {
  try {
    return readJson<Learnset>(path.join("learnsets", `${versionGroup}.json`));
  } catch {
    return {};
  }
}

// Full level-up movesets (all moves, for the Pokédex card's move list + the
// Battle tab's explosion warning) and the shared localized move-name table.
export function getMoveset(versionGroup: string): Moveset {
  try {
    return readJson<Moveset>(path.join("movesets", `${versionGroup}.json`));
  } catch {
    return {};
  }
}

// On disk each move carries its description in all five UI languages; the
// table is handed to a client component, so shipping all of them would put
// ~4x more JSON on the wire than the page can ever show.
type MoveInfoFile = Omit<MoveInfo, "flavor"> & { flavor?: Record<string, string> };

// Localized move names/descriptions + battle stats, shared across games.
// `lang` picks which description survives into the payload (falling back
// lang -> en -> de like localizeName does); omit it to drop descriptions
// entirely, for consumers that only need names and types.
export function getMoves(lang?: Lang): MovesTable {
  try {
    const raw = readJson<Record<string, MoveInfoFile>>("moves.json");
    const out: MovesTable = {};
    for (const [slug, info] of Object.entries(raw)) {
      const { flavor, ...rest } = info;
      const text = lang ? flavor?.[lang] ?? flavor?.en ?? flavor?.de : undefined;
      out[slug] = text ? { ...rest, flavor: text } : rest;
    }
    return out;
  } catch {
    return {};
  }
}

// Hand-curated corrections for moves whose type PokeAPI only tracks as its
// current (latest-generation) value - see MoveTypeHistoryEntry.
export function getMoveTypeHistory(): MoveTypeHistoryEntry[] {
  try {
    return readJson<MoveTypeHistoryEntry[]>("move-type-history.json");
  } catch {
    return [];
  }
}

// Official TM/HM/tutor compatibility per version group (move -> learners),
// for the TM-compatibility tab. Missing file -> {} (tab just shows nothing).
export function getTmCompat(versionGroup: string): TmCompatTable {
  try {
    return readJson<TmCompatTable>(path.join("tm-compat", `${versionGroup}.json`));
  } catch {
    return {};
  }
}
