"use client";

import { useState } from "react";

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// A plain `value={n} onChange={clampInt(...)}` re-clamps every keystroke,
// including the empty string left behind while deleting - which snaps back
// to `min` before the next digit can be typed. Mobile number keyboards make
// this unusable (deleting "100" to type "45" never gets past "1"). Buffering
// the raw text separately and only committing (clamped) once it parses to a
// number - restoring the last committed value on blur if the field was left
// empty - lets the field go through an intermediate empty/partial state.
//
// This buffering alone is NOT enough, though: pair it with `type="text"
// inputMode="numeric"`, never `type="number"`. A native number input runs
// its own min/max/step validation at the browser level, independent of (and
// prone to overriding) this buffering entirely - observed on mobile as a
// field that can be walked down to `min` but never below it or emptied,
// even though the React state itself is happy to hold `""`.
export function useClampedIntInput(
  value: number,
  min: number,
  max: number,
  fallback: number,
  onCommit: (n: number) => void,
) {
  const [text, setText] = useState(String(value));
  // Re-sync from an external value change (e.g. a quick-set button, or a
  // fresh state on Pokémon switch) during render rather than in an effect -
  // React explicitly supports conditional setState mid-render (it re-renders
  // immediately without committing/painting the stale version).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  return {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setText(raw);
      if (raw !== "" && Number.isFinite(Number(raw))) onCommit(clampInt(raw, min, max, fallback));
    },
    onBlur: () => setText(String(value)),
  };
}
