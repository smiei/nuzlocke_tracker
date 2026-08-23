"use client";

import { useCallback, useSyncExternalStore } from "react";

// Drives the "install app" entry in the gear menu.
//
// The captured `beforeinstallprompt` event does NOT live in React state: on a
// warm repeat visit Chrome fires it before hydration, so a listener registered
// in a useEffect misses it and the menu entry intermittently never appears.
// An inline script in the root layout stashes it on window during HTML parse
// and re-dispatches a custom event; this hook just reads that stash.
//
// useSyncExternalStore rather than useState+useEffect for two reasons: it is
// the right primitive for external mutable state, and it keeps the
// client-only values out of an effect (a setState there would trip the
// react-hooks/set-state-in-effect rule this repo holds at a fixed baseline).

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __nuzlockeInstallPrompt?: InstallPromptEvent | null;
  }
}

// Kept in sync with the inline script in src/app/layout.tsx.
export const INSTALL_PROMPT_EVENT = "nuzlocke:installprompt";

function subscribePrompt(onChange: () => void) {
  window.addEventListener(INSTALL_PROMPT_EVENT, onChange);
  return () => window.removeEventListener(INSTALL_PROMPT_EVENT, onChange);
}

const readPrompt = () => window.__nuzlockeInstallPrompt ?? null;
const readPromptOnServer = () => null;

// A store that never changes: false while rendering on the server and during
// hydration, true afterwards. Lets the client-only checks below run without a
// mounted flag held in state.
const subscribeNever = () => () => {};
const readTrue = () => true;
const readFalse = () => false;

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS does not implement display-mode; it has its own flag instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as "Macintosh"; the touch-point count is what
  // separates an iPad from an actual Mac.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function useInstallPrompt() {
  const promptEvent = useSyncExternalStore(subscribePrompt, readPrompt, readPromptOnServer);
  const mounted = useSyncExternalStore(subscribeNever, readTrue, readFalse);

  const promptInstall = useCallback(async () => {
    const event = window.__nuzlockeInstallPrompt;
    if (!event) return false;
    // prompt() has to be reached synchronously from the click handler -
    // awaiting anything before it spends the user gesture and Chrome refuses.
    void event.prompt();
    const { outcome } = await event.userChoice;
    // The event is single-use, whatever the outcome.
    window.__nuzlockeInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    return outcome === "accepted";
  }, []);

  return {
    // Chromium only. Safari and Firefox never fire beforeinstallprompt, so
    // these fall back to a written hint instead of a dead button.
    canPrompt: mounted && promptEvent !== null,
    isStandalone: mounted && isStandaloneDisplay(),
    isIos: mounted && isIosDevice(),
    mounted,
    promptInstall,
  };
}
