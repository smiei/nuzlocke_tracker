"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SPRITE_SET } from "@/lib/sprites";
import type { FusionSpriteConfig } from "@/lib/gameData";

export type { FusionSpriteConfig };

// Which sprite folder PokemonSprite loads from, plus (Infinite Fusion only)
// the fan-art CDN config PokemonSprite needs for a `bodyId` - see
// FusionSpriteConfig and CLAUDE.md's Infinite Fusion section. Run-scoped
// pages wrap their content with the run's game spriteSet (+ fusion config
// when the pack has one); everything else (Pokédex, type chart, header)
// falls back to the default sprite set with no fusion capability, so no page
// HAS to provide either.
type SpriteSetValue = { spriteSet: string; fusion: FusionSpriteConfig | null };

const SpriteSetContext = createContext<SpriteSetValue>({
  spriteSet: DEFAULT_SPRITE_SET,
  fusion: null,
});

export function SpriteSetProvider({
  spriteSet,
  fusion = null,
  children,
}: {
  spriteSet: string;
  fusion?: FusionSpriteConfig | null;
  children: React.ReactNode;
}) {
  return (
    <SpriteSetContext.Provider value={{ spriteSet, fusion }}>{children}</SpriteSetContext.Provider>
  );
}

export function useSpriteSet(): string {
  return useContext(SpriteSetContext).spriteSet;
}

export function useFusionSprites(): FusionSpriteConfig | null {
  return useContext(SpriteSetContext).fusion;
}
