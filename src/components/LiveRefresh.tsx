"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSessionExpired } from "@/lib/sessionProbe";

// Listens to the /api/events SSE stream and refreshes the current view when
// another client changes run data - so both players see edits live without
// switching tabs.
//
// Events within a short window are coalesced into one refresh, both to avoid
// refresh storms on bulk changes (e.g. a backup import) and because the client
// that caused the change refreshes itself already.
//
// Reconnecting is more involved than it looks, for two unrelated reasons:
//
// 1. EventSource retries by itself after a plain network drop, but NOT after a
//    fatal error - and behind Cloudflare Access an expired session produces
//    exactly that: the reconnect is answered with an HTML login page, and a
//    wrong content-type closes the stream for good.
// 2. **iOS 18 lies about the state.** In a standalone PWA, backgrounding the
//    app for ~20s kills the connection, but WebKit fires no `error` and leaves
//    `readyState` at OPEN (Apple Developer Forums thread 765183, still
//    unanswered). Both signals the reconnect logic would normally use are
//    therefore unusable there - which is why an iPhone silently stopped seeing
//    the other player's nicknames until a tab switch remounted this component.
//
// So the recovery below never trusts readyState: it rebuilds the stream
// whenever the page becomes visible, and it watches the server's `ping` events
// as a liveness signal, reconnecting when they stop arriving.

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;
const FAILURES_BEFORE_SESSION_CHECK = 3;
// The server pings every 20s. Three missed pings is a dead stream - long
// enough not to trip on a slow mobile network.
const SILENCE_LIMIT_MS = 70_000;
const WATCHDOG_INTERVAL_MS = 15_000;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let current: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = FIRST_RETRY_MS;
    let failures = 0;
    let lastSeen = Date.now();
    let stopped = false;

    function connect() {
      if (stopped) return;
      current?.close();
      const source = new EventSource("/api/events");
      current = source;
      lastSeen = Date.now();

      source.onopen = () => {
        retryDelay = FIRST_RETRY_MS;
        failures = 0;
        lastSeen = Date.now();
      };

      // Named event, so it never reaches onmessage and never triggers a
      // refresh - it exists purely so the watchdog below can tell a live
      // stream from a dead one.
      source.addEventListener("ping", () => {
        lastSeen = Date.now();
      });

      source.onmessage = () => {
        lastSeen = Date.now();
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => router.refresh(), 300);
      };

      source.onerror = async () => {
        // Still meaningful on Chromium and desktop Safari; on iOS 18 it simply
        // never fires, which the watchdog covers instead.
        if (source.readyState !== EventSource.CLOSED) return;
        source.close();
        if (current === source) current = null;
        failures += 1;
        if (failures >= FAILURES_BEFORE_SESSION_CHECK && (await isSessionExpired())) {
          window.location.reload();
          return;
        }
        if (stopped) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      };
    }

    // Coming back to the app: rebuild the stream unconditionally rather than
    // asking whether it is still alive, because on iOS the answer would be a
    // confident, wrong "yes". The refresh catches whatever was missed while
    // the app was away.
    function onVisible() {
      if (document.visibilityState !== "visible" || stopped) return;
      connect();
      router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    // Covers a stream that dies without the app ever being backgrounded.
    const watchdog = setInterval(() => {
      if (stopped || document.visibilityState !== "visible") return;
      if (Date.now() - lastSeen > SILENCE_LIMIT_MS) connect();
    }, WATCHDOG_INTERVAL_MS);

    connect();

    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      current?.close();
    };
  }, [router]);

  return null;
}
