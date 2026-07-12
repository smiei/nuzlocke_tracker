import { getGames, getPokemonList } from "@/lib/data";
import { PokedexTable } from "@/components/PokedexTable";

export default function PokedexPage() {
  // Statically prerendered - no run context here. The table filters by game
  // client-side (dexLimit), defaulting to the first (default) game pack.
  const pokemon = getPokemonList();
  const games = getGames().map((g) => ({ id: g.id, names: g.names, dexLimit: g.dexLimit }));

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Pokédex</h2>
      <PokedexTable pokemon={pokemon} games={games} />
    </div>
  );
}
