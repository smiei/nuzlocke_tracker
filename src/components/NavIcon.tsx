import type { ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/nav";

type NavHref = (typeof NAV_ITEMS)[number]["href"];

// Hand-drawn line icons for the tab strip, in the same idiom as HeaderMenu's
// gear: a 24 viewBox, no fills, currentColor so they inherit the active/
// inactive text colour for free. Deliberately own artwork - no icon set is
// bundled, and nothing here alludes to Pokémon imagery.
//
// Typed as a full Record over NAV_ITEMS' hrefs, so adding a tab to nav.ts
// without giving it an icon fails the build rather than rendering a blank gap.
const SHAPES: Record<NavHref, ReactNode> = {
  // Dashboard: four tiles.
  "/overview": (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  // Encounter: a map pin - catches happen per route.
  "/tracker": (
    <>
      <path d="M12 21.5s7-6 7-11.5a7 7 0 1 0-14 0c0 5.5 7 11.5 7 11.5z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  // Team: two figures, the SoulLink pair.
  "/links": (
    <>
      <circle cx="9" cy="7.5" r="3.2" />
      <path d="M2.5 20v-1.4a4.2 4.2 0 0 1 4.2-4.2h4.6a4.2 4.2 0 0 1 4.2 4.2V20" />
      <path d="M16.2 4.6a3.4 3.4 0 0 1 0 6.5" />
      <path d="M18.2 14.7a4.2 4.2 0 0 1 3.3 4.1V20" />
    </>
  ),
  // Kampf & Fang: a bolt, i.e. type effectiveness.
  "/typen": <path d="M13.5 2.5 4.5 13.5h6L10 21.5l9.5-11.5h-6.5z" />,
  // Reise: a milestone flag.
  "/levelcaps": (
    <>
      <path d="M5.5 21.5V2.5" />
      <path d="M5.5 3.5h12l-2.4 4 2.4 4h-12" />
    </>
  ),
  // Pokédex: a book.
  "/pokedex": (
    <>
      <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H20" />
      <path d="M7.5 2.5H20v19H7.5A2.5 2.5 0 0 1 5 19V5a2.5 2.5 0 0 1 2.5-2.5z" />
    </>
  ),
  // TMs: a machine disc.
  "/tms": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3a9 9 0 0 1 7.8 4.5" />
    </>
  ),
  // Regeln: a clipboard with a tick.
  "/rules": (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 4.5v-1a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3.5v1" />
      <path d="M9.5 13l2 2 3.5-4" />
    </>
  ),
};

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const shape = SHAPES[href as NavHref];
  if (!shape) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {shape}
    </svg>
  );
}
