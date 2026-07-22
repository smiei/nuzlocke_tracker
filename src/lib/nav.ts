// The ?run= param rides along on every tab - even the static pages that
// don't read it - so switching to one of those and back never loses the
// selected run (they'd otherwise fall back to the first run).
export const NAV_ITEMS = [
  { href: "/tracker", labelKey: "tracker" },
  { href: "/links", labelKey: "links" },
  { href: "/typen", labelKey: "typen" },
  { href: "/weaknesses", labelKey: "weaknesses" },
  { href: "/tms", labelKey: "tms" },
  { href: "/catchrate", labelKey: "catchrate" },
  { href: "/pokedex", labelKey: "pokedex" },
  { href: "/levelcaps", labelKey: "levelcaps" },
  { href: "/rules", labelKey: "rules" },
] as const;
