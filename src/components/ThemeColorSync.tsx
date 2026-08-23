"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

// Keeps <meta name="theme-color"> in step with the active theme, which decides
// the status-bar colour of the installed PWA on both Android and iOS.
//
// The static value in layout.tsx's `viewport` export cannot do this alone, and
// neither can a media-scoped theme-color: next-themes toggles a `dark` class on
// <html>, which prefers-color-scheme never sees. Without this, a user whose OS
// is light but who switched the app to dark keeps a white status bar above a
// near-black page. Colours match what <body> actually paints, i.e. `bg-white`
// and `dark:bg-zinc-950`.
const THEME_COLORS = { light: "#ffffff", dark: "#09090b" };

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light);
  }, [resolvedTheme]);

  return null;
}
