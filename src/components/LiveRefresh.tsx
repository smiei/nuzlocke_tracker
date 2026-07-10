"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Listens to the /api/events SSE stream and refreshes the current view when
// another client changes run data - so both players see edits live without
// switching tabs. EventSource reconnects automatically after drops.
//
// Events within a short window are coalesced into one refresh, both to avoid
// refresh storms on bulk changes (e.g. a backup import) and because the
// client that caused the change refreshes itself already.
export function LiveRefresh() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      source.close();
    };
  }, [router]);

  return null;
}
