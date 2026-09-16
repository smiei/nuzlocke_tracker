// The run and version the current page was rendered with, shared between the
// page (CanonicalRun reports it) and the header-level poller (LiveRefresh),
// which cannot read ?run= itself without a Suspense boundary of its own.
//
// Reporting the RENDERED version is what keeps a player's own edits from
// costing a second refresh: their action is followed by router.refresh(), the
// page comes back with the bumped version, and the next poll sees nothing new.

export type RenderedRun = { key: string; version: number };

let current: RenderedRun | null = null;
const listeners = new Set<(run: RenderedRun | null) => void>();

export function reportRenderedRun(run: RenderedRun | null) {
  if (current?.key === run?.key && current?.version === run?.version) return;
  current = run;
  for (const listener of listeners) listener(current);
}

export function subscribeRenderedRun(listener: (run: RenderedRun | null) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
