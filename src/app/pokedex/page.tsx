import { getPokemonList } from "@/lib/data";
import { PokedexTable } from "@/components/PokedexTable";

export default function PokedexPage() {
  const pokemon = getPokemonList();

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Pokédex</h2>
      <PokedexTable pokemon={pokemon} />
    </div>
  );
}
