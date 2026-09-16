import { IS_PUBLIC_INSTANCE } from "@/lib/instance";
import spriteSources from "../../data/sprite-sources.json";

// Pokémon battle sprites and item (ball) icons.
//
// A private instance serves them locally from /public/pokemon-sprites/<set>/
// and /public/ball-sprites/ - downloaded once via scripts/download-sprites.mjs
// (self-hosted: at container start, onto a persisted volume) - no runtime
// dependency on an external CDN.
//
// A public instance has no persisted filesystem to download into and no
// container-start hook to do it in, and serving them from the deployment's own
// domain would cost a Vercel Edge Request per sprite. It hotlinks the same
// PokeAPI sprite mirror the download script itself reads from instead -
// data/sprite-sources.json holds the one config both share, generated once
// from download-sprites.mjs's own tables so they cannot drift apart. Which
// mode applies is IS_PUBLIC_INSTANCE (src/lib/instance.ts); everything below
// is keyed off it.
//
// Which set a run uses comes from its game pack's game.json (spriteSet);
// game-agnostic pages (Pokédex, type chart) use the default set.
export const DEFAULT_SPRITE_SET = "emerald";

type SpriteSetConfig = { path: string; maxId: number; formFallbackPath?: string };
const SPRITE_SETS = spriteSources.sets as Record<string, SpriteSetConfig>;
const IF_BALL_FILES = spriteSources.infiniteFusionBalls as Record<string, string>;

// Forme ids (Deoxys' formes, Rotom's appliances, ...) start here - see
// src/lib/forms.ts.
const FORME_ID_THRESHOLD = 10001;

// Every URL worth trying for this Pokémon's battle sprite, most preferred
// first. Locally there is exactly one (a missing file 404s, same as always).
// Hotlinked, a forme also gets its set's fallback path: coverage is patchy by
// design (a Gen-3 Deoxys forme depended on the cartridge, so Emerald only ever
// shipped one of its formes) - download-sprites.mjs tries the same two paths
// when populating a volume, this just defers that choice to the browser via
// PokemonSprite's onError chain instead of deciding it once at download time.
export function getPokemonSpriteUrls(pokemonId: number, spriteSet: string = DEFAULT_SPRITE_SET): string[] {
  if (!IS_PUBLIC_INSTANCE) return [`/pokemon-sprites/${spriteSet}/${pokemonId}.png`];

  const config = SPRITE_SETS[spriteSet] ?? SPRITE_SETS[DEFAULT_SPRITE_SET];
  const urls = [`${spriteSources.pokeApiBase}/pokemon/${config.path}/${pokemonId}.png`];
  if (pokemonId >= FORME_ID_THRESHOLD && config.formFallbackPath) {
    urls.push(`${spriteSources.pokeApiBase}/pokemon/${config.formFallbackPath}/${pokemonId}.png`);
  }
  return urls;
}

// The single most-preferred URL, for call sites that don't render a fallback
// chain themselves.
export function getPokemonSpriteUrl(pokemonId: number, spriteSet: string = DEFAULT_SPRITE_SET): string {
  return getPokemonSpriteUrls(pokemonId, spriteSet)[0];
}

// A ball's item-sprite icon (src/lib/catchrate.ts ball ids). Infinite Fusion's
// own balls (see CLAUDE.md) have no PokeAPI sprite at all, hotlinked or not -
// their icon always comes from the game's own repository.
export function getBallSpriteUrl(ballId: string): string {
  if (!IS_PUBLIC_INSTANCE) return `/ball-sprites/${ballId}.png`;

  const ifFile = IF_BALL_FILES[ballId];
  if (ifFile) return `${spriteSources.infiniteFusionItemsBase}/${ifFile}.png`;
  return `${spriteSources.pokeApiBase}/items/${ballId}-ball.png`;
}
