"use client";

import { useEffect } from "react";

// The `?run=` param IS the app's run selection - it is what the nav links carry
// from page to page - so it has to end up on the address bar even when the
// visitor arrived without it (the PWA's start_url is a bare `/tracker`), with
// a stale key pointing at a run that has since been deleted, or with a numeric
// id bookmarked before runs had access keys.
//
// This used to be a server-side `redirect()`. That stopped producing a 307 the
// moment `app/loading.tsx` existed: the loading shell is flushed before the
// page component runs, so Next can only fall back to a
// `<meta http-equiv="refresh" content="1;...">` - a one-second pause plus a
// full document reload on every cold start of the app. Rewriting the URL in
// place costs neither, and the page has already rendered the right run anyway
// (resolveRunId falls back on its own); Next patches history.replaceState so
// the router and useSearchParams stay in sync with it.
export function CanonicalRun({ runKey }: { runKey: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("run") === runKey) return;
    url.searchParams.set("run", runKey);
    window.history.replaceState(null, "", url);
  }, [runKey]);
  return null;
}
