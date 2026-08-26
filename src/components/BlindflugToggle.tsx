"use client";

import { useTransition } from "react";
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

  const requested = Number(searchParams.get("run"));
  const run = runs.find((r) => r.id === requested) ?? runs[0];
  const on = run ? parseRunSettings(run.settingsJson).blindflug : false;

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
        className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          on
            ? "border-blindflug text-blindflug"
            : "border-line text-ink-muted hover:bg-hover hover:text-ink"
        }`}
      >
        {pending ? <Spinner /> : <BlindfoldIcon className="h-5 w-5" />}
      </button>

      {/* The "you are in this mode" marker, on every page and every scroll
          position without covering anything: a hairline pinned to the top of
          the viewport. z-30 keeps it under Modal (50) and Toast (60) but over
          the sticky tab strip (40), so it stays visible while the strip slides
          up and down. */}
      {on && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-30 h-1 bg-blindflug"
        />
      )}
    </>
  );
}
