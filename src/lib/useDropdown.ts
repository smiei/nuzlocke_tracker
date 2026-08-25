"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Open/close state for a popover anchored to a trigger: the ball picker, the
 * evolve and forme menus, the team-slot picker, the type filter, the gear menu
 * and the two search comboboxes.
 *
 * All nine carried their own copy of the same `mousedown` listener, and only
 * the two comboboxes closed on Escape - and those only while the text input
 * itself had focus. Doing it once here fixes the other seven for free.
 *
 * Two details that the copies got wrong:
 *
 * - The listeners are only attached while the menu is open. The copies
 *   subscribed on mount and stayed subscribed for the life of the page, which
 *   on the Team tab means one document-level listener per card.
 * - Escape is handled on the container, not on `document`. A container listener
 *   sees the event on its way up from whatever is focused inside the menu and
 *   can stop it there, so a dropdown inside a dialog would close the dropdown
 *   rather than the dialog. `document` (which is where ui/Modal listens, in the
 *   capture phase) could never give that order.
 */
export function useDropdown<T extends HTMLElement = HTMLDivElement>(
  // Runs whenever the menu closes by itself - clicking away or pressing
  // Escape - so a combobox can put its text back to the current selection.
  onDismiss?: () => void,
) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<T>(null);

  // Latest-callback ref, so a new closure on every render does not re-subscribe
  // the listeners.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  const close = useCallback(() => {
    setOpen(false);
    dismissRef.current?.();
  }, []);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;

    function onPointerDown(event: MouseEvent) {
      if (container && !container.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    }

    document.addEventListener("mousedown", onPointerDown);
    container?.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      container?.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return { open, setOpen, close, toggle, containerRef };
}
