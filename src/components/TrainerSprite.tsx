"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";

// No free, reliably hotlinkable sprite source exists for these (German-named,
// game-specific) trainers - unlike Pokémon, which come straight from the
// PokeAPI sprite repo. This reads from /public/trainers/<slug>.png instead;
// if that file isn't there, it quietly falls back to an initial-letter badge
// rather than a broken image icon.
//
// canonicalName (always the original German name) drives the file lookup -
// the user's sprite files are named by German slugs (rocko.png, not
// brock.png) - while displayName is whatever language the UI is currently
// showing, used only for the alt text / fallback initial.
export function TrainerSprite({
  canonicalName,
  displayName,
  size = 40,
}: {
  canonicalName: string;
  displayName: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const slug = slugify(canonicalName);

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
      >
        {displayName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/trainers/${slug}.png`}
      alt={displayName}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
