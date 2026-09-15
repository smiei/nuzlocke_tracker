// Every page reads Pokemon/type/catch data through THIS module rather than
// calling data.ts's generation-keyed functions with `game.generation`
// directly. That split exists for Infinite Fusion: its battle mechanics are
// Gen 5 (catch formula, ball list - still `game.generation`), but its
// Pokemon/type roster is newer (Fairy exists) and its species list is not a
// contiguous "id <= dexLimit" range. See the three new GameInfo fields
// (dataGeneration, species, nameLang) for what each one overrides.
//
// For every pack before Infinite Fusion none of these fields are set, so
// every function here is byte-for-byte what the old direct calls returned -
// pinned by gameDataRegression.test.ts.
import {
  getPokemonList,
  getPokemonById,
  getPokemonForms,
  getEffectiveness,
  getCatchRates,
  getMoves,
  getSpeciesList,
  type GameInfo,
  type Pokemon,
  type CatchRateEntry,
} from "@/lib/data";
import { getTypesForGeneration, type EffectivenessTable } from "@/lib/effectiveness";
import { LANGS, type Lang } from "@/lib/i18n/dictionary";
import type { LocalizedNames } from "@/lib/i18n/localize";
import type { MovesTable } from "@/lib/learnset";

// Public so a page can forward the SAME number into a client component's
// `generation` prop that this module used internally for Pokemon/type/move
// data - keeping one source of truth for "which era does this pack's data
// come from" instead of a page re-deriving it. NOTE: components that do their
// own raw arithmetic against a `dexLimit` PROP (e.g. PokemonDetailModal's
// evolution-chain walk, `id <= dexLimit`) still assume a contiguous range and
// are not yet allowlist-aware - see isInDex()'s comment. That's deferred
// until a species-allowlist pack actually reaches the UI (Phase 4).
export function getDataGenerationForGame(game: GameInfo): number {
  return game.dataGeneration ?? game.generation;
}

const dataGeneration = getDataGenerationForGame;

function speciesAllowlist(game: GameInfo): Set<number> | undefined {
  if (!game.species) return undefined;
  return new Set(getSpeciesList(game.id).map((entry) => entry.ourId));
}

// Rewrites every language key to the same string, so localizeName()'s
// lang -> en -> de fallback returns that string no matter the UI language -
// zero changes needed in any component that displays a name.
function forceNameLang(names: LocalizedNames, nameLang: Lang): LocalizedNames {
  const value = names[nameLang] ?? names.en ?? names.de;
  return Object.fromEntries(LANGS.map((lang) => [lang, value])) as LocalizedNames;
}

function applyNameLang(game: GameInfo, pokemon: Pokemon): Pokemon {
  if (!game.nameLang) return pokemon;
  return {
    ...pokemon,
    names: forceNameLang(pokemon.names, game.nameLang),
    formNames: pokemon.formNames ? forceNameLang(pokemon.formNames, game.nameLang) : undefined,
  };
}

export function getPokemonListForGame(game: GameInfo): Pokemon[] {
  const generation = dataGeneration(game);
  const allowed = speciesAllowlist(game);
  const list = allowed
    ? getPokemonList(undefined, generation).filter((p) => allowed.has(p.id))
    : getPokemonList(game.dexLimit, generation);
  return game.nameLang ? list.map((p) => applyNameLang(game, p)) : list;
}

export function getPokemonByIdForGame(game: GameInfo, id: number): Pokemon | undefined {
  const pokemon = getPokemonById(id, dataGeneration(game));
  return pokemon && game.nameLang ? applyNameLang(game, pokemon) : pokemon;
}

export function getPokemonFormsForGame(game: GameInfo): Pokemon[] {
  const generation = dataGeneration(game);
  const allowed = speciesAllowlist(game);
  const forms = allowed
    ? getPokemonList(undefined, generation).filter(
        (p) => p.baseId !== undefined && allowed.has(p.baseId),
      )
    : getPokemonForms(game.dexLimit, generation);
  return game.nameLang ? forms.map((p) => applyNameLang(game, p)) : forms;
}

export function getEffectivenessForGame(game: GameInfo): EffectivenessTable {
  return getEffectiveness(dataGeneration(game));
}

export function getCatchRatesForGame(game: GameInfo): CatchRateEntry[] {
  return getCatchRates(dataGeneration(game));
}

export function getMovesForGame(game: GameInfo, lang: Lang): MovesTable {
  return getMoves(lang, dataGeneration(game));
}

export function getAttackTypesForGame(game: GameInfo): string[] {
  return getTypesForGeneration(dataGeneration(game));
}

// `game.dexLimit` is also read directly in a few places as a raw ceiling
// (evolution-target filtering, ranking's pool size) rather than through
// getPokemonList. Those need the same allowlist-vs-ceiling split; this is the
// membership check to use there instead of `id <= game.dexLimit`.
export function isInDex(game: GameInfo, id: number): boolean {
  const allowed = speciesAllowlist(game);
  return allowed ? allowed.has(id) : id <= game.dexLimit;
}

// This app's pokemon.json id -> the source game's own dex id, keyed off
// species.json (see getSpeciesList) - what SpriteSetProvider needs to build a
// fusion CDN URL (see FusionSpriteConfig and CLAUDE.md's Infinite Fusion
// section). null for every pack without game.fusion set, so passing this
// straight into SpriteSetProvider is safe everywhere.
export type FusionSpriteConfig = {
  spriteBase: string;
  customPath: string;
  generatedPath: string;
  ifIdByOurId: Record<number, number>;
};

export function getFusionSpriteConfigForGame(game: GameInfo): FusionSpriteConfig | null {
  if (!game.fusion) return null;
  const ifIdByOurId: Record<number, number> = {};
  for (const entry of getSpeciesList(game.id)) ifIdByOurId[entry.ourId] = entry.ifId;
  return { ...game.fusion, ifIdByOurId };
}
