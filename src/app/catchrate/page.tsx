import { getCatchRates, getPokemonList } from "@/lib/data";
import { CatchRateView } from "@/components/CatchRateView";

export default function CatchratePage() {
  const catchRates = Object.fromEntries(
    getCatchRates().map((entry) => [entry.id, entry.catch_rate]),
  );
  return <CatchRateView pokemonList={getPokemonList()} catchRates={catchRates} />;
}
