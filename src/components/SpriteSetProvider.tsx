"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SPRITE_SET } from "@/lib/sprites";

// Which sprite folder PokemonSprite loads from. Run-scoped pages wrap their
// content with the run's game spriteSet; everything else (Pokédex, type
// chart, header) falls back to the default so no page HAS to provide it.
const SpriteSetContext = createContext<string>(DEFAULT_SPRITE_SET);

export function SpriteSetProvider({
  spriteSet,
  children,
}: {
  spriteSet: string;
  children: React.ReactNode;
}) {
  return <SpriteSetContext.Provider value={spriteSet}>{children}</SpriteSetContext.Provider>;
}

export function useSpriteSet(): string {
  return useContext(SpriteSetContext);
}
