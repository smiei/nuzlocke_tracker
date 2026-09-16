"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IS_PUBLIC_INSTANCE } from "@/lib/instance";
import { reportRenderedRun } from "@/lib/runVersionStore";
import { rememberRun } from "@/lib/visitedRuns";

// Every run-scoped page renders this once, for the run it resolved.
//
// 1. The `?run=` param IS the app's run selection - it is what the nav links
//    carry from page to page - so it has to end up on the address bar even when
//    the visitor arrived without it (the PWA's start_url is a bare `/tracker`),
//    with a stale key pointing at a run that has since been deleted, or with a
//    numeric id bookmarked before runs had access keys.
//
//    This used to be a server-side `redirect()`. That stopped producing a 307
//    the moment `app/loading.tsx` existed: the loading shell is flushed before
//    the page component runs, so Next can only fall back to a
//    `<meta http-equiv="refresh" content="1;...">` - a one-second pause plus a
//    full document reload on every cold start of the app. Rewriting the URL in
//    place costs neither, and the page has already rendered the right run
//    anyway; Next patches history.replaceState so the router and
//    useSearchParams stay in sync with it.
//
// 2. It tells the poller (LiveRefresh) which run and version are on screen.
//
// 3. On a public instance it records the run in this browser's visited list.
//    A run opened here for the first time is not in the server-rendered run
//    switcher yet, so that one visit refreshes once.
export function CanonicalRun({ runKey, version }: { runKey: string; version: number }) {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("run") !== runKey) {
      url.searchParams.set("run", runKey);
      window.history.replaceState(null, "", url);
    }
    if (IS_PUBLIC_INSTANCE && rememberRun(runKey)) router.refresh();
  }, [runKey, router]);

  useEffect(() => {
    reportRenderedRun({ key: runKey, version });
    return () => reportRenderedRun(null);
  }, [runKey, version]);

  return null;
}
