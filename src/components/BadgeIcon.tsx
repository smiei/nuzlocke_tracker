"use client";

import { useState } from "react";
import { badgeSlug } from "@/lib/badges";

// Badge icons are served locally from /public/badges (downloaded once via
// scripts/download-badges.mjs), same "?" fallback pattern as PokemonSprite
// for the rare case a file is still missing (fresh volume, download failed).
export function BadgeIcon({
  nameEn,
  label,
  earned,
  size = 40,
}: {
  nameEn: string;
  label: string;
  earned: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
        title={label}
      >
        ?
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/badges/${badgeSlug(nameEn)}.png`}
      alt={label}
      title={label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain transition-[filter,opacity] ${
        earned ? "" : "opacity-40 grayscale"
      }`}
      style={{ width: size, height: size }}
    />
  );
}
