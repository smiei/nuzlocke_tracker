// Pure Infinite Fusion math: given a head species and a body species, what
// stats/types/catch rate does the fusion have. No DB rows, no sprites - a
// fusion is computed on the fly from its two components every time, per the
// plan's Phase 2 (see CLAUDE.md's Infinite Fusion section). Client-safe.
import type { Pokemon, PokemonStats } from "@/lib/data";

// ---------------------------------------------------------------------------
// Stats: floor((2 * dominant + other) / 3) per stat (Infinite Fusion Fandom
// wiki's "Fusion FAQs"). HP/Sp.Atk/Sp.Def are head-dominant; Atk/Def/Speed
// are body-dominant. Summe is recomputed from the six rounded stats rather
// than blended from the two Summes, so it always equals what it should add
// up to (per-stat floor() means the two aren't interchangeable).
// ---------------------------------------------------------------------------

const blend = (dominant: number, other: number): number => Math.floor((2 * dominant + other) / 3);

export function computeFusionStats(head: Pokemon, body: Pokemon): PokemonStats {
  const h = head.stats;
  const b = body.stats;
  const KP = blend(h.KP, b.KP);
  const Ang = blend(b["Ang."], h["Ang."]);
  const Vert = blend(b["Vert."], h["Vert."]);
  const SpA = blend(h["Sp.-A."], b["Sp.-A."]);
  const SpV = blend(h["Sp.-V."], b["Sp.-V."]);
  const Init = blend(b["Init."], h["Init."]);
  return {
    KP,
    "Ang.": Ang,
    "Vert.": Vert,
    "Sp.-A.": SpA,
    "Sp.-V.": SpV,
    "Init.": Init,
    Summe: KP + Ang + Vert + SpA + SpV + Init,
  };
}

// ---------------------------------------------------------------------------
// Typing: head contributes its primary type, body its secondary (falling
// back to its primary if it has none, or if it would duplicate the head's
// type). Ported from the reference tracker's src/lib/typings.ts (Infinite
// Fusion's own "latest ruleset v6.3+"), tests included, rather than
// reinvented - two deliberate quirks carried over as-is because they are
// what the actual game does, not oversights:
//   - A handful of species use a different EFFECTIVE type order in a fusion
//     than their displayed order (TYPE_ORDER_SWAPS below) - e.g. Magnemite's
//     line is Electric/Steel on its own Pokedex page, but contributes Steel
//     first in a fusion.
//   - Normal/Flying dual types (Pidgeot & co.) always contribute Flying
//     rather than Normal, in EITHER role (DOMINANT_FLYING below) - the one
//     dominant-type override the actual ruleset defines.
//   - If a single-typed body's only type already equals the head's
//     contributed type, the fallback-to-primary rule "falls back" to the
//     SAME type, so the pair comes out as a duplicate (e.g. head Poison +
//     body pure-Poison stays Poison/Poison). This mirrors the reference
//     implementation's own behaviour, not a bug introduced here.
// ---------------------------------------------------------------------------

// National-dex id -> effective [primary, secondary] order used ONLY for
// fusion typing, never for displaying that species on its own.
const TYPE_ORDER_SWAPS: Record<number, [string, string]> = {
  81: ["steel", "electric"], // Magnemite
  82: ["steel", "electric"], // Magneton
  442: ["dark", "ghost"], // Spiritomb
  462: ["steel", "electric"], // Magnezone
  597: ["steel", "grass"], // Ferroseed
  598: ["steel", "grass"], // Ferrothorn
  708: ["grass", "ghost"], // Phantump
  709: ["grass", "ghost"], // Trevenant
  769: ["ground", "ghost"], // Sandygast
  770: ["ground", "ghost"], // Palossand
};

type EffectiveTypes = { primary: string; secondary?: string };

function effectiveTypeOrder(pokemon: Pokemon): EffectiveTypes {
  const swap = TYPE_ORDER_SWAPS[pokemon.id];
  if (swap) return { primary: swap[0], secondary: swap[1] };
  const [primary, secondary] = pokemon.types;
  return { primary, secondary };
}

function dominantFlying(pokemon: Pokemon): string | undefined {
  return pokemon.types.includes("normal") && pokemon.types.includes("flying")
    ? "flying"
    : undefined;
}

export function computeFusionTypes(head: Pokemon, body: Pokemon): [string, string] {
  const headOrder = effectiveTypeOrder(head);
  const bodyOrder = effectiveTypeOrder(body);
  const headDominant = dominantFlying(head);
  const bodyDominant = dominantFlying(body);

  const headType = headDominant ?? headOrder.primary;

  // Body has the same dominant override as the head - use its primary
  // instead so the pair isn't just "Flying" twice.
  if (bodyDominant && bodyDominant === headType) return [headType, bodyOrder.primary];
  // The dominant override always wins over the ordinary secondary/primary
  // pick, in either direction.
  if (bodyDominant) return [headType, bodyDominant];

  const desiredBody = bodyOrder.secondary ?? bodyOrder.primary;
  if (desiredBody === headType) return [headType, bodyOrder.primary];
  return [headType, desiredBody];
}

// ---------------------------------------------------------------------------
// Catch rate: the LOWER of the two components' base rates (Fusion FAQs).
// Feeds straight into the existing baseRate input of computeCatchChance /
// effectiveBaseRate in src/lib/catchrate.ts - no new formula needed there,
// same pattern the Heavy Ball's weight modifier already uses.
// ---------------------------------------------------------------------------

export function fusionCatchBaseRate(headRate: number, bodyRate: number): number {
  return Math.min(headRate, bodyRate);
}
