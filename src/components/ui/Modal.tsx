"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { cn } from "./cn";

// One dialog implementation. Six hand-rolled overlays existed, all carrying the
// identical `fixed inset-0 z-50 …` string, and between them: none trapped
// focus, only two closed on Escape, none locked body scroll, none restored
// focus, and only two carried role/aria-modal. Fixing that six times over was
// never going to happen; fixing it once here does.
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  titleHidden = false,
  size = "sm",
  // Dialogs holding typed input opt out: a stray backdrop tap discarding a
  // half-filled import form is exactly the kind of thing that reads as clunky.
  dismissOnBackdrop = true,
  onSubmit,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  // Always the accessible name. `titleHidden` only drops the visible header -
  // a confirm dialog whose whole content is one sentence does not need one.
  title: string;
  titleHidden?: boolean;
  size?: Size;
  dismissOnBackdrop?: boolean;
  // Makes the panel itself a <form>, so Enter submits from any field. The
  // footer sits inside it, which a form wrapped around `children` alone could
  // not manage.
  onSubmit?: (event: FormEvent) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first control rather than the panel, so a keyboard user lands
    // somewhere useful and a screen reader announces it.
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Wrap at both ends, otherwise Tab walks straight out into the page
      // behind the overlay.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const body = (
    <>
      {!titleHidden && (
        <h2 className="border-b border-line px-4 py-3 text-base font-semibold text-ink">{title}</h2>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          {footer}
        </div>
      )}
    </>
  );

  const panelProps = {
    // A callback ref, because the panel is a <div> or a <form> depending on
    // onSubmit and a typed useRef cannot be handed to both.
    ref: (element: HTMLElement | null) => {
      panelRef.current = element;
    },
    role: "dialog",
    "aria-modal": true,
    "aria-label": title,
    tabIndex: -1,
    onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    className: cn(
      "flex max-h-[85vh] w-full flex-col rounded-lg border border-line bg-panel shadow-xl",
      SIZES[size],
    ),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      {onSubmit ? (
        <form {...panelProps} onSubmit={onSubmit}>
          {body}
        </form>
      ) : (
        <div {...panelProps}>{body}</div>
      )}
    </div>
  );
}
