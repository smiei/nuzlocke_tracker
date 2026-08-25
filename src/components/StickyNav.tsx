"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Keeps the tab strip reachable without giving up screen height: it sticks to
// the top of the viewport, slides out of the way while you read downwards, and
// comes straight back the moment you scroll up - not only once you reach the
// top of the page, which is the whole point on a long list like the Encounter
// tab.
//
// It is a sibling of <header>, not a child, and that is load-bearing: a sticky
// element cannot leave its parent's box, so nested inside the header it would
// unstick and scroll away the instant the header did.

// How far down the page the strip has to be before it may hide at all -
// roughly the height of the title row above it, so it never slides over
// something that is still on screen.
const HIDE_BELOW = 96;
// Scroll jitter below this is ignored. Without it the strip flickers on a
// trackpad and on the rubber-band bounce at the end of a list.
const DELTA = 8;

export function StickyNav({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function update() {
      ticking.current = false;
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y < HIDE_BELOW) {
        setHidden(false);
      } else if (dy > DELTA) {
        setHidden(true);
      } else if (dy < -DELTA) {
        setHidden(false);
      } else {
        // Under the threshold: leave lastY alone so slow drags still add up
        // to a decision instead of being swallowed.
        return;
      }
      lastY.current = y;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    }

    // A tab switch scrolls to the top, which fires this and reveals the strip
    // again - no separate effect on the pathname needed.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      // z-40: under Modal (50) and Toast (60), over page content.
      // motion-reduce drops the slide, not the behaviour.
      className={`sticky top-0 z-40 border-b border-line bg-canvas transition-transform duration-200 motion-reduce:transition-none ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}
