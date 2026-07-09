"use client";

import { useEffect, useState } from "react";
import { getPokemonSpriteUrl } from "@/lib/sprites";

const SIZES = {
  sm: 32,
  md: 48,
  lg: 96,
  xl: 140,
} as const;

// This page can fire off a few hundred sprite requests at once (e.g. the full
// Pokédex table). If GitHub's raw-content CDN stalls/throttles under that
// load, a plain <img> sits in "loading" state and the browser shows the alt
// text in its place - a word truncated to the tiny image box instead of the
// sprite. Keeping the image invisible until it actually finishes (success or
// error) avoids that ever being visible, while still keeping the alt text
// for screen readers.
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
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const px = SIZES[size];

  useEffect(() => {
    setStatus("loading");
  }, [pokemonId]);

  if (status === "failed") {
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
      src={getPokemonSpriteUrl(pokemonId)}
      alt={name}
      width={px}
      height={px}
      loading="lazy"
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("failed")}
      style={{
        imageRendering: "pixelated",
        visibility: status === "loading" ? "hidden" : "visible",
      }}
      className={`shrink-0 ${className}`}
    />
  );
}
