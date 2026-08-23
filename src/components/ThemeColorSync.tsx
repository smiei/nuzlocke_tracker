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
    const wanted = resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;

    const apply = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && meta.getAttribute("content") !== wanted) meta.setAttribute("content", wanted);
    };

    apply();

    // Setting it once is not enough. Next re-emits the tags from the `viewport`
    // export on every client-side navigation, which puts the static default
    // back - that is why switching tabs in dark mode turned the status bar
    // white and left it white: this effect had no reason to run again, since
    // the theme itself never changed. Watching <head> re-applies the value
    // whenever Next rewrites or replaces the tag, covering route changes and
    // run switches alike. The equality guard in apply() is what stops the
    // observer from reacting to its own write.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    });
    return () => observer.disconnect();
  }, [resolvedTheme]);

  return null;
}
