"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";

// No free, reliably hotlinkable sprite source exists for these (German-named,
// game-specific) trainers - unlike Pokémon, which come straight from the
// PokeAPI sprite repo. This reads user-provided files instead, trying in order:
//   1. /trainers/<trainerSet>/<slug>.png  - game-specific art (e.g. the rival,
//      which looks different in Emerald vs Platinum). trainerSet is the game's
//      trainerSet (defaults to its id); HeartGold/SoulSilver share one set.
//   2. /trainers/<slug>.png               - shared fallback, so a trainer with
//      the same German name across games (e.g. Brock) needs only one file.
//   3. an initial-letter badge            - when no file is provided at all.
//
// canonicalName (always the original German name, or a levelcaps.json `sprite`
// override) drives the file lookup - the user's files are named by German slugs
// (rocko.png, not brock.png) - while displayName is whatever language the UI is
// currently showing, used only for the alt text / fallback initial.
export function TrainerSprite({
  canonicalName,
  displayName,
  trainerSet,
  size = 40,
}: {
  canonicalName: string;
  displayName: string;
  trainerSet?: string;
  size?: number;
}) {
  const slug = slugify(canonicalName);
  // Ordered candidate URLs: game-specific first, then the shared flat root.
  const sources = trainerSet
    ? [`/trainers/${trainerSet}/${slug}.png`, `/trainers/${slug}.png`]
    : [`/trainers/${slug}.png`];
  // Which candidate we're currently attempting; advanced on each load error.
  const [stage, setStage] = useState(0);

  if (stage >= sources.length) {
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
      // Key on the slug so switching runs/games remounts and retries from stage 0.
      key={`${trainerSet ?? ""}/${slug}`}
      src={sources[stage]}
      alt={displayName}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
