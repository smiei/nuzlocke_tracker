"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSessionExpired } from "@/lib/sessionProbe";
import { IS_PUBLIC_INSTANCE } from "@/lib/instance";
import { subscribeRenderedRun } from "@/lib/runVersionStore";
import { forgetRun } from "@/lib/visitedRuns";

// Keeps every device looking at a run up to date with the others. A private
// instance is one long-running process and pushes changes over SSE
// (EventStreamRefresh); a public one polls the run's version number
// (VersionPolling), see src/lib/instance.ts.
export function LiveRefresh() {
  return IS_PUBLIC_INSTANCE ? <VersionPolling /> : <EventStreamRefresh />;
}

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

function EventStreamRefresh() {
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

// Public instances: ask the server for the run's version number (one indexed
// row, see /api/runs/[key]/version) and re-render only when it moved.
//
// Every poll is a billed function invocation, so the cadence is the budget:
// fast right after a change (the other players are active), easing off while
// nothing happens, nothing at all while the tab is hidden, and a full pause
// after a long stretch without anybody touching this device. Coming back -
// tab visible again, a tap, back online - checks at once.
//
// The versions a page was RENDERED with count as seen (CanonicalRun reports
// them), so a player's own edit, which refreshes itself, does not trigger a
// second refresh from the poll that notices it.
const POLL_FAST_MS = 5_000;
const POLL_SLOW_MS = 30_000;
const POLL_BACKOFF = 1.5;
const POLL_IDLE_PAUSE_MS = 10 * 60_000;

function VersionPolling() {
  const router = useRouter();

  useEffect(() => {
    const seen = new Map<string, number>();
    let activeKey: string | null = null;
    let delay = POLL_FAST_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let lastInteraction = Date.now();
    let stopped = false;

    function schedule(ms: number) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, ms);
    }

    async function poll() {
      timer = null;
      if (stopped || inFlight || activeKey === null) return;
      // Both resume through their own listeners below.
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteraction > POLL_IDLE_PAUSE_MS) return;

      const key = activeKey;
      inFlight = true;
      try {
        const response = await fetch(`/api/runs/${key}/version`, { cache: "no-store" });
        if (response.status === 404) {
          // Deleted by another device. Let the server decide what this
          // browser opens instead - its next visited run, or the landing page.
          seen.delete(key);
          forgetRun(key);
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { version } = (await response.json()) as { version: number };
        if (version > (seen.get(key) ?? -1)) {
          seen.set(key, version);
          delay = POLL_FAST_MS;
          router.refresh();
        } else {
          delay = Math.min(delay * POLL_BACKOFF, POLL_SLOW_MS);
        }
      } catch {
        delay = Math.min(delay * 2, POLL_SLOW_MS);
      } finally {
        inFlight = false;
      }
      if (!stopped && activeKey !== null) schedule(delay);
    }

    const unsubscribe = subscribeRenderedRun((run) => {
      if (run === null) {
        activeKey = null;
        return;
      }
      seen.set(run.key, Math.max(seen.get(run.key) ?? -1, run.version));
      if (activeKey !== run.key) {
        activeKey = run.key;
        delay = POLL_FAST_MS;
        schedule(delay);
      } else if (timer === null && !inFlight) {
        schedule(delay);
      }
    });

    function checkNow() {
      delay = POLL_FAST_MS;
      schedule(0);
    }
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      lastInteraction = Date.now();
      checkNow();
    }
    function onInteraction() {
      const wasIdle = Date.now() - lastInteraction > POLL_IDLE_PAUSE_MS;
      lastInteraction = Date.now();
      if (wasIdle) checkNow();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", checkNow);
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", checkNow);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
    };
  }, [router]);

  return null;
}
