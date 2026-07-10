import fs from "node:fs";
import path from "node:path";
import type { EffectivenessTable } from "@/lib/effectiveness";

// Static reference data lives in /data as JSON, not in the DB (see project spec).
// Read fresh from disk on every call (no in-memory caching) so the bind-mounted
// files in Docker can be edited without rebuilding or restarting the container.
const DATA_DIR = path.join(process.cwd(), "data");

// "route" = normal wild encounter; "static" = fixed encounter (NPC gift,
// purchase, fossil, Snorlax, legendaries). Statics are exempt from the
// Species Clause and need no manual flag in the UI.
export type RouteType = "route" | "static";

export type Route = {
  id: number;
  name: string;
  name_en: string;
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
  name_de: string;
  name_en: string;
  types: string[];
  family_id: number;
  stats: PokemonStats;
};

export type LevelCap = {
  id: number;
  name: string;
  name_en: string;
  location: string;
  location_en: string;
  badge: string | null;
  badge_en: string | null;
  // null for fights without a level cap (rival / Team Rocket boss battles).
  max_level: number | null;
  // Optional sprite-file override (German slug) when it differs from `name`,
  // e.g. the rival reuses the champion's sprite ("champ").
  sprite?: string;
};

function readJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export function getRoutes(): Route[] {
  return readJson<Route[]>("routes.json");
}

export function getRouteById(routeId: number): Route | undefined {
  return getRoutes().find((route) => route.id === routeId);
}

export function getPokemonList(): Pokemon[] {
  return readJson<Pokemon[]>("pokemon.json");
}

export function getPokemonById(pokemonId: number): Pokemon | undefined {
  return getPokemonList().find((pokemon) => pokemon.id === pokemonId);
}

export function getLevelCaps(): LevelCap[] {
  return readJson<LevelCap[]>("levelcaps.json");
}

export type EvolutionEntry = {
  id: number;
  evolvesFrom: number | null;
  evolvesTo: number[];
};

export function getEvolutions(): EvolutionEntry[] {
  return readJson<EvolutionEntry[]>("evolutions.json");
}

export function getEvolutionById(pokemonId: number): EvolutionEntry | undefined {
  return getEvolutions().find((entry) => entry.id === pokemonId);
}

export function getEffectiveness(): EffectivenessTable {
  return readJson<EffectivenessTable>("effectiveness.json");
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
