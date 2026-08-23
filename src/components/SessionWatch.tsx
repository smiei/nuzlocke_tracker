"use client";

import { useEffect } from "react";
import { isSessionExpired } from "@/lib/sessionProbe";

// Reloads the page once the Cloudflare Access session has expired, so the
// login form appears while the user is idle rather than halfway through
// deleting a run. See src/lib/sessionProbe.ts for why this is needed at all.
//
// Only relevant for the installed PWA, but harmless in a browser tab, so it is
// not gated on display-mode: an expired session is worth surfacing either way.

const PROBE_INTERVAL_MS = 15 * 60 * 1000;

export function SessionWatch() {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      // A background tab reloading itself would throw away scroll position and
      // any half-typed nickname for no benefit - wait until it is looked at.
      if (document.visibilityState !== "visible") return;
      if (await isSessionExpired()) {
        if (!cancelled) window.location.reload();
      }
    }

    const timer = setInterval(check, PROBE_INTERVAL_MS);

    // A Server Action whose POST was redirected to the login page rejects
    // somewhere React cannot route into an ActionError, so the calling
    // component's pending flag stays stuck on. Catching the stray rejection is
    // the cheap way to turn that dead end into a login prompt. (The thorough
    // fix is a wrapper around every action call site; this is the safety net.)
    function onRejection() {
      void check();
    }
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
