"use client";

import { useCallback } from "react";
import { usePersistentState } from "@/lib/usePersistentState";

// Which runs have the debug order export switched on, ON THIS DEVICE.
//
// Deliberately not a run setting: Run.settingsJson is server state and is
// live-synced over SSE, so flipping it on the PC would have put the export
// button on the phone in the middle of a session. This is a personal
// maintenance switch, which is what the localStorage prefs are for - same
// treatment as tab order and the Team tab's sort mode.
//
// Still scoped per run (the toggle lives on the run-scoped Rules tab), hence a
// set of run ids rather than one boolean. Changing this key or its shape
// silently discards whatever a device already stored - treat it as a format.
const DEBUG_RUNS_KEY = "nuzlocke:debugRuns";

export function useDebugMode(runId: number): [boolean, (on: boolean) => void] {
  // usePersistentState is SSR-safe (useSyncExternalStore): the server renders
  // "off" and the stored value applies during hydration, with no
  // set-state-in-effect and no flash of the wrong state.
  const [runIds, setRunIds] = usePersistentState<number[]>(DEBUG_RUNS_KEY, []);
  const enabled = Array.isArray(runIds) && runIds.includes(runId);

  const setEnabled = useCallback(
    (on: boolean) => {
      setRunIds((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        return on ? [...new Set([...current, runId])] : current.filter((id) => id !== runId);
      });
    },
    [setRunIds, runId],
  );

  return [enabled, setEnabled];
}
