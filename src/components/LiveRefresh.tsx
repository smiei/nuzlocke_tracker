"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSessionExpired } from "@/lib/sessionProbe";

// Listens to the /api/events SSE stream and refreshes the current view when
// another client changes run data - so both players see edits live without
// switching tabs.
//
// Events within a short window are coalesced into one refresh, both to avoid
// refresh storms on bulk changes (e.g. a backup import) and because the
// client that caused the change refreshes itself already.
//
// EventSource retries by itself after a plain network drop, but NOT after a
// fatal error - and behind Cloudflare Access an expired session produces
// exactly that: the reconnect is answered with an HTML login page, and a wrong
// content-type closes the stream permanently (readyState CLOSED). Live sync
// would then be dead with no visible symptom at all, which is why this
// reconnects by hand with backoff and, after a few failures in a row, checks
// whether the session is what is actually wrong.

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;
const FAILURES_BEFORE_SESSION_CHECK = 3;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let current: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = FIRST_RETRY_MS;
    let failures = 0;
    let stopped = false;

    function connect() {
      if (stopped) return;
      const source = new EventSource("/api/events");
      current = source;

      source.onopen = () => {
        retryDelay = FIRST_RETRY_MS;
        failures = 0;
      };

      source.onmessage = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => router.refresh(), 300);
      };

      source.onerror = async () => {
        // CONNECTING means EventSource is already retrying on its own - leave
        // it be. CLOSED is the terminal state it never recovers from.
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

    connect();

    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      current?.close();
    };
  }, [router]);

  return null;
}
