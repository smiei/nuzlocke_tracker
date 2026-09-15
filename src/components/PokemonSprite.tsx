"use client";

import { useState } from "react";
import { getPokemonSpriteUrl } from "@/lib/sprites";
import { useSpriteSet, useFusionSprites, type FusionSpriteConfig } from "@/components/SpriteSetProvider";

const SIZES = {
  sm: 32,
  md: 48,
  lg: 96,
  xl: 140,
} as const;

// Ordered fallback chain of candidate URLs for one sprite. Infinite Fusion
// only (see CLAUDE.md): a hand-drawn fan sprite first, then the algorithmic
// blend (fusions only - there is nothing to "generate" for a single
// species), then the locally-downloaded set (works for ids <= 649, 404s
// above that - the CDN is this pack's only real coverage past FireRed/
// LeafGreen's own dex), so every pack ends up with at least one candidate.
function spriteCandidates(
  pokemonId: number,
  bodyId: number | null,
  spriteSet: string,
  fusion: FusionSpriteConfig | null,
): string[] {
  const candidates: string[] = [];
  if (fusion) {
    const headIf = fusion.ifIdByOurId[pokemonId];
    if (bodyId != null) {
      const bodyIf = fusion.ifIdByOurId[bodyId];
      if (headIf != null && bodyIf != null) {
        candidates.push(`${fusion.spriteBase}/${fusion.customPath}/${headIf}.${bodyIf}.png`);
        candidates.push(`${fusion.spriteBase}/${fusion.generatedPath}/${headIf}.${bodyIf}.png`);
      }
    } else if (headIf != null) {
      candidates.push(`${fusion.spriteBase}/${fusion.customPath}/${headIf}.png`);
    }
  }
  candidates.push(getPokemonSpriteUrl(pokemonId, spriteSet));
  return candidates;
}

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
// load error, tracked per-identity so an evolution/fusion change to a working
// sprite recovers.
//
// `bodyId` re-introduces a hotlinked CDN for Infinite Fusion fusions/singles
// past this app's own dex (see spriteCandidates above) - the per-identity
// tracking below doubles as the multi-candidate fallback's position, not just
// a single failed/ok flag, so a dead custom-art URL still tries the
// algorithmic blend and the local set before giving up.
export function PokemonSprite({
  pokemonId,
  bodyId = null,
  name,
  size = "md",
  className = "",
}: {
  pokemonId: number;
  // Infinite Fusion only: the donor's currentPokemonId, when this card is a
  // fusion. null (the default) renders a single species exactly as before.
  bodyId?: number | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const spriteSet = useSpriteSet();
  const fusion = useFusionSprites();
  const identity = `${pokemonId}:${bodyId ?? ""}`;
  const [failedStage, setFailedStage] = useState<{ identity: string; stage: number } | null>(null);
  const stage = failedStage && failedStage.identity === identity ? failedStage.stage : 0;
  const px = SIZES[size];

  const candidates = spriteCandidates(pokemonId, bodyId, spriteSet, fusion);

  if (stage >= candidates.length) {
    return (
      <div
        style={{ width: px, height: px }}
        className={`flex shrink-0 items-center justify-center rounded-md bg-sunken text-xs text-ink-subtle ${className}`}
      >
        ?
      </div>
    );
  }

  const src = candidates[stage];
  const isHotlinked = src.startsWith("http");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      referrerPolicy={isHotlinked ? "no-referrer" : undefined}
      onError={() => setFailedStage({ identity, stage: stage + 1 })}
      style={{ imageRendering: "pixelated" }}
      className={`shrink-0 ${className}`}
    />
  );
}
