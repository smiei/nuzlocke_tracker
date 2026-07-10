import { getEffectiveness, getPokemonList } from "@/lib/data";
import { TypeEffectivenessView } from "@/components/TypeEffectivenessView";

export default function TypeneffektivitaetPage() {
  return <TypeEffectivenessView pokemonList={getPokemonList()} table={getEffectiveness()} />;
}
