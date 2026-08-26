"use client";

import { useCallback } from "react";
import { usePersistentState } from "@/lib/usePersistentState";
import { UI_SCALE_DEFAULT, UI_SCALE_KEY, UI_SCALE_STEPS, clampScaleIndex } from "@/lib/uiScale";

// Reads and writes the per-device UI size. The constants and the boot script
// live in uiScale.ts so layout.tsx (a server component) can reach them.
export function useUiScale(): [number, (index: number) => void] {
  const [raw, setRaw] = usePersistentState<number>(UI_SCALE_KEY, UI_SCALE_DEFAULT);
  const index = clampScaleIndex(raw);

  // Applied in the setter, not in an effect: on a cold load the inline boot
  // script has already set it, so an effect would only ever repeat that work
  // on every mount.
  const setIndex = useCallback(
    (next: number) => {
      const clamped = clampScaleIndex(next);
      setRaw(clamped);
      try {
        document.documentElement.style.fontSize = UI_SCALE_STEPS[clamped];
      } catch {
        // Storage or DOM unavailable - the boot script applies the stored
        // value on the next load.
      }
    },
    [setRaw],
  );

  return [index, setIndex];
}
