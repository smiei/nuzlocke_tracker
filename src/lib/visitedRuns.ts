import { isRunKeyShaped } from "@/lib/runKey";

// The runs this browser has opened, most recent first - the public instance's
// replacement for "list every run in the database". A cookie rather than
// localStorage because the server needs it: the layout renders the run
// switcher from it, and a bare URL opens the most recent run, both without an
// extra request. It only ever holds keys the browser already had in a URL, so
// it grants nothing new.
export const VISITED_RUNS_COOKIE = "nuzlocke_runs";
export const MAX_VISITED_RUNS = 30;
const SEPARATOR = ".";

export function parseVisitedRuns(value: string | undefined | null): string[] {
  if (!value) return [];
  const keys: string[] = [];
  for (const part of value.split(SEPARATOR)) {
    if (isRunKeyShaped(part) && !keys.includes(part)) keys.push(part);
    if (keys.length === MAX_VISITED_RUNS) break;
  }
  return keys;
}

export function withVisitedRun(keys: readonly string[], key: string): string[] {
  return [key, ...keys.filter((k) => k !== key)].slice(0, MAX_VISITED_RUNS);
}

export function withoutVisitedRun(keys: readonly string[], key: string): string[] {
  return keys.filter((k) => k !== key);
}

// --- browser side ------------------------------------------------------------

function readCookie(): string[] {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${VISITED_RUNS_COOKIE}=`));
  return parseVisitedRuns(entry?.slice(VISITED_RUNS_COOKIE.length + 1));
}

function writeCookie(keys: readonly string[]) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Chrome caps a cookie's lifetime at 400 days; every visit rewrites it.
  document.cookie = `${VISITED_RUNS_COOKIE}=${keys.join(SEPARATOR)}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`;
}

// Moves `key` to the front. Returns whether it was new to this browser, i.e.
// whether a server-rendered run list is now out of date.
export function rememberRun(key: string): boolean {
  const keys = readCookie();
  const isNew = !keys.includes(key);
  if (keys[0] !== key) writeCookie(withVisitedRun(keys, key));
  return isNew;
}

export function forgetRun(key: string) {
  writeCookie(withoutVisitedRun(readCookie(), key));
}
