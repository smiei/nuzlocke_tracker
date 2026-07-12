import { getEffectiveness, getGames, getPokemonList } from "@/lib/data";
import { TypeEffectivenessView } from "@/components/TypeEffectivenessView";

export default function TypeneffektivitaetPage() {
  // Statically prerendered - no run context. The view filters by game
  // client-side (chart, dex scope, sprites), sharing the per-device game
  // preference with the Pokédex tab.
  const games = getGames().map((g) => ({
    id: g.id,
    names: g.names,
    dexLimit: g.dexLimit,
    generation: g.generation,
    spriteSet: g.spriteSet,
  }));

  return (
    <TypeEffectivenessView
      pokemonList={getPokemonList()}
      games={games}
      tables={{ gen1: getEffectiveness(1), standard: getEffectiveness(3) }}
    />
  );
}
