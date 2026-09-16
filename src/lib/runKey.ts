// Run access keys (Run.accessKey), client-safe. A key is the run's address in
// every `?run=` URL and the only thing a server action accepts to find a run,
// because the numeric id is a counter anybody could walk through.
//
// Keys are opaque: nanoid (21 chars) for runs created by Prisma, 32 hex chars
// for runs that existed before keys did (see the add_run_access_key
// migration). The shape check only rejects what cannot possibly be a key -
// numbers, objects, empty or absurdly long strings - before it reaches a query.

const RUN_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isRunKeyShaped(value: unknown): value is string {
  return typeof value === "string" && RUN_KEY_PATTERN.test(value);
}

type SelectableRun = { id: number; accessKey: string };

// Which of `runs` the `?run=` param names, the way resolveRunId decides it on
// the server: the key, then a bare numeric id (bookmarks from before keys
// existed), then the oldest run. Client components that sit outside a page -
// the run switcher, the header menu, the Blindflug toggle - use it so they
// agree with the page underneath before CanonicalRun has rewritten the URL.
export function pickActiveRun<T extends SelectableRun>(runs: readonly T[], param: string | null): T | undefined {
  if (param) {
    const byKey = runs.find((run) => run.accessKey === param);
    if (byKey) return byKey;
    if (/^\d{1,9}$/.test(param)) {
      const byId = runs.find((run) => run.id === Number(param));
      if (byId) return byId;
    }
  }
  return runs[0];
}
