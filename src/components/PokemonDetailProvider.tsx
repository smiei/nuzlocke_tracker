"use client";

import { createContext, useContext, useState } from "react";
import type { Pokemon, EvolutionEntry } from "@/lib/data";
import type { Moveset, MovesTable } from "@/lib/learnset";
import type { EffectivenessTable } from "@/lib/effectiveness";
import type { Lang } from "@/lib/i18n/dictionary";
import { PokemonDetailModal } from "@/components/PokemonDetailModal";

// Lets any component under a run-scoped page open the Pokédex detail card
// (Pokémon tab sprite click, Encounter/Catchrate info buttons, Pokédex rows)
// without every one of them threading the game data through props. The page
// provides the game-scoped data once; consumers just call open(id).
type DetailContext = { open: (pokemonId: number) => void };

const Ctx = createContext<DetailContext | null>(null);

export function PokemonDetailProvider({
  pokemonList,
  evolutions,
  moveData,
  effectiveness,
  generation,
  dexLimit,
  lang,
  children,
}: {
  pokemonList: Pokemon[];
  evolutions: EvolutionEntry[];
  moveData: { movesets: Moveset; moves: MovesTable };
  effectiveness: EffectivenessTable;
  generation: number;
  dexLimit: number;
  lang: Lang;
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const pokemon = openId != null ? pokemonList.find((p) => p.id === openId) ?? null : null;

  return (
    <Ctx.Provider value={{ open: setOpenId }}>
      {children}
      {pokemon && (
        <PokemonDetailModal
          pokemon={pokemon}
          allPokemon={pokemonList}
          evolutions={evolutions}
          movesets={moveData.movesets}
          moves={moveData.moves}
          effectiveness={effectiveness}
          generation={generation}
          dexLimit={dexLimit}
          lang={lang}
          onSelect={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </Ctx.Provider>
  );
}

// Returns null when no provider is present, so components can degrade
// gracefully (e.g. a sprite that just isn't clickable).
export function usePokemonDetail(): DetailContext | null {
  return useContext(Ctx);
}

// Small "ⓘ" button that opens the detail card for a Pokémon; renders nothing
// when there's no provider or no Pokémon selected.
export function PokemonInfoButton({
  pokemonId,
  label,
}: {
  pokemonId: number | null;
  label: string;
}) {
  const detail = useContext(Ctx);
  if (!detail || pokemonId == null) return null;
  return (
    <button
      type="button"
      onClick={() => detail.open(pokemonId)}
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xs font-serif italic text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      i
    </button>
  );
}
