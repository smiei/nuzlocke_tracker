"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// A localStorage-backed useState (per device/client, never synced across
// clients) via useSyncExternalStore: SSR renders `initial`, the client swaps in
// the stored value during hydration with no set-state-in-effect and no flash.
// Used to keep transient work state (Battle/Catchrate card selections, levels,
// card count; tab order/visibility) alive across tab switches and reloads.
//
// The native "storage" event only fires in OTHER tabs, so same-document writes
// notify a small module-level registry keyed by storage key.
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
}

function subscribeKey(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function read<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Corrupt/unavailable storage - fall through to the initial value.
  }
  return initial;
}

export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback((cb: () => void) => subscribeKey(key, cb), [key]);
  // Snapshot is the raw string (stable by value) so React doesn't loop; parsing
  // happens in a memo keyed on it, keeping the returned value's identity stable.
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null, // server snapshot: no storage -> `initial`
  );

  const value = useMemo<T>(() => {
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` intentionally excluded: `raw` is the only input that changes the
    // parsed value, and excluding it preserves the value's identity per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(read(key, initial)) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full/unavailable - subscribers still re-read the old value.
      }
      notify(key);
    },
    // `initial` only seeds the functional-update read and is stable per site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set];
}
