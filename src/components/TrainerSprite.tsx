"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";

// No free, reliably hotlinkable sprite source exists for these (German-named,
// game-specific) trainers - unlike Pokémon, which come straight from the
// PokeAPI sprite repo. This reads from /public/trainers/<slug>.png instead;
// if that file isn't there, it quietly falls back to an initial-letter badge
// rather than a broken image icon.
export function TrainerSprite({ name, size = 40 }: { name: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const slug = slugify(name);

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/trainers/${slug}.png`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
