"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateRunSettings } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { parseRunSettings } from "@/lib/runSettings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";

function BlindfoldIcon({ className }: { className?: string }) {
  // An eye with a slash through it: the app is not looking things up for you.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"
      />
      <circle cx="12" cy="12" r="2.5" />
      <path strokeLinecap="round" d="M3 21 21 3" />
    </svg>
  );
}

// Sits next to the theme toggle, because that is where a "how does this thing
// present itself to me" switch belongs. It writes a RUN setting though, not a
// device one: Blindflug is a house rule both players agreed to, so it syncs.
//
// The current run is resolved the same way resolveRunId does on the server -
// ?run= if it names a real run, otherwise the oldest - so the button agrees
// with the page underneath it even before CanonicalRun has put ?run= on the
// address bar.
export function BlindflugToggle({
  runs,
}: {
  runs: { id: number; settingsJson: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = translations[lang].blindflug;
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);

  const requested = Number(searchParams.get("run"));
  const run = runs.find((r) => r.id === requested) ?? runs[0];
  const on = run ? parseRunSettings(run.settingsJson).blindflug : false;

  // Fire the sweep on the TRANSITION into the mode, not in the click handler.
  // Blindflug is a run setting, so updateRunSettings publishes over SSE and
  // every device in the run refreshes - hooking the animation to the incoming
  // state means the other player's phone stages the moment too, instead of
  // just quietly sprouting hazard tape.
  //
  // Synced during render rather than in an effect, the pattern RulesView uses:
  // an effect here would land on the set-state-in-effect lint baseline. On
  // first mount prevOn starts equal to `on`, so opening a page that is already
  // in Blindflug does not sweep - only entering it does.
  const [prevOn, setPrevOn] = useState(on);
  if (prevOn !== on) {
    setPrevOn(on);
    // Only on the way IN. Leaving the mode is a return to normal and needs no
    // staging.
    if (on) setFlash(true);
  }

  // No runs yet (a fresh database, before the first page resolves one): there
  // is nothing to toggle, and a dead button is worse than none.
  if (!run) return null;

  function toggle() {
    if (!run) return;
    startTransition(async () => {
      const result = await updateRunSettings(run.id, { blindflug: !on });
      if (result.success) router.refresh();
      else toast.error(formatActionError(result.error, lang));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? t.disable : t.enable}
        title={on ? t.disable : t.enable}
        // Active it grows from an icon square into a labelled pill. The mode
        // is not a preference you set once and forget - it should be legible
        // from across the room which state the run is in.
        className={`flex h-10 items-center justify-center gap-2 rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          on
            ? "border-blindflug bg-blindflug/10 px-3 text-blindflug"
            : "w-10 border-line text-ink-muted hover:bg-hover hover:text-ink"
        }`}
      >
        {pending ? <Spinner /> : <BlindfoldIcon className="h-5 w-5" />}
        {on && <span className="text-xs uppercase tracking-wider">{t.name}</span>}
      </button>

      {/* Hazard tape across the top of the viewport: the run is sealed off.
          z-30 keeps it under Modal (50) and Toast (60) but over the sticky tab
          strip (40), so it stays put while the strip slides up and down. */}
      {on && (
        <div
          aria-hidden
          className="blindflug-tape pointer-events-none fixed inset-x-0 top-0 z-30 h-2"
        />
      )}

      {/* One scan down the page as the mode comes on, then gone. It unmounts
          itself on animationend rather than on a timer, so it cannot outlive
          its own animation - see the reduced-motion note in globals.css. */}
      {flash && (
        <div
          aria-hidden
          onAnimationEnd={() => setFlash(false)}
          className="blindflug-flash pointer-events-none fixed inset-0 z-40"
        />
      )}
    </>
  );
}
