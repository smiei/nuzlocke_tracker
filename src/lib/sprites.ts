// Gen 3 (Emerald) battle sprites, downloaded once via scripts/download-sprites.mjs
// and served locally from /public/pokemon-sprites - no runtime dependency on
// an external CDN (avoids GitHub raw-content throttling under bursts of
// requests, e.g. the full Pokédex table loading ~386 sprites at once).
export function getPokemonSpriteUrl(pokemonId: number): string {
  return `/pokemon-sprites/${pokemonId}.png`;
}
