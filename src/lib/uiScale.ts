// Per-device UI size: the parts that are NOT a hook, so the server component
// in layout.tsx can import them. The hook itself lives in useUiScale.ts, which
// carries "use client" - a server component cannot call an export from such a
// module, it only gets a client reference back.
//
// It works by setting the ROOT font size and nothing else: Tailwind v4 sizes
// text, heights, padding, gaps and radii in rem, so one declaration on <html>
// scales the whole interface - including the 40/44px touch targets, which is
// the point of making it bigger in the first place.
//
// Deliberately per device (localStorage, like tab order and the debug switch):
// how big the type is on a phone has nothing to do with the run, and syncing
// it would resize the other player's screen mid-game.
export const UI_SCALE_KEY = "nuzlocke:uiScale";

// Percentages of the browser's own default rather than absolute pixel sizes,
// so someone who has already raised their browser font keeps that as the base.
export const UI_SCALE_STEPS = ["87.5%", "93.75%", "100%", "112.5%", "125%"] as const;
export const UI_SCALE_DEFAULT = 2;

export function clampScaleIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return UI_SCALE_DEFAULT;
  if (value < 0 || value >= UI_SCALE_STEPS.length) return UI_SCALE_DEFAULT;
  return value;
}

// The snippet layout.tsx runs before first paint, kept next to the key and the
// steps so the three cannot drift apart. It is stringified into the document,
// so it stays ES5-safe and self-contained, and swallows everything: a browser
// with storage blocked must still render the page.
export function uiScaleBootScript(): string {
  return (
    "(function(){try{var v=JSON.parse(localStorage.getItem(" +
    JSON.stringify(UI_SCALE_KEY) +
    "));var s=" +
    JSON.stringify(UI_SCALE_STEPS) +
    ');if(typeof v==="number"&&s[v])document.documentElement.style.fontSize=s[v]}catch(e){}})();'
  );
}
