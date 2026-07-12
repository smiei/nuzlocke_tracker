"use client";

import { useState } from "react";
import { getPokemonSpriteUrl } from "@/lib/sprites";
import { useSpriteSet } from "@/components/SpriteSetProvider";

const SIZES = {
  sm: 32,
  md: 48,
  lg: 96,
  xl: 140,
} as const;

// Sprites are served locally from /public/pokemon-sprites (downloaded once via
// scripts/download-sprites.mjs), so they load instantly and reliably.
//
// We deliberately do NOT hide the <img> until onLoad. That old guard - added
// back when sprites were hotlinked from a throttling CDN and the browser would
// flash the alt text - actually breaks with local images: a cached sprite can
// finish loading before React attaches the onLoad handler, so the event never
// fires and the element stayed stuck at visibility:hidden (blank until the
// component happened to remount, e.g. on a tab switch). Rendering the image
// directly avoids that race entirely; we only swap in a "?" tile on a genuine
// load error, tracked per-id so an evolution to a working sprite recovers.
export function PokemonSprite({
  pokemonId,
  name,
  size = "md",
  className = "",
}: {
  pokemonId: number;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const spriteSet = useSpriteSet();
  const [failedId, setFailedId] = useState<number | null>(null);
  const px = SIZES[size];

  if (failedId === pokemonId) {
    return (
      <div
        style={{ width: px, height: px }}
        className={`flex shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 ${className}`}
      >
        ?
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getPokemonSpriteUrl(pokemonId, spriteSet)}
      alt={name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={() => setFailedId(pokemonId)}
      style={{ imageRendering: "pixelated" }}
      className={`shrink-0 ${className}`}
    />
  );
}
