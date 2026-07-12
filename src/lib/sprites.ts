// Pokémon battle sprites, downloaded once per sprite set via
// scripts/download-sprites.mjs and served locally from
// /public/pokemon-sprites/<set>/ - no runtime dependency on an external CDN.
// Which set a run uses comes from its game pack's game.json (spriteSet);
// game-agnostic pages (Pokédex, type chart) use the default set.
export const DEFAULT_SPRITE_SET = "emerald";

export function getPokemonSpriteUrl(pokemonId: number, spriteSet: string = DEFAULT_SPRITE_SET): string {
  return `/pokemon-sprites/${spriteSet}/${pokemonId}.png`;
}
