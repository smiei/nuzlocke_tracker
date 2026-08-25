"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDeathPoint } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

export type DeathPointOption = { id: number; label: string };

// Sets WHERE in the run a link died, as a Journey milestone. New deaths record
// this automatically (markDead); this exists for the ones that predate the
// tracking, so the Memorial can be put in order after the fact.
export function DeathPointPicker({
  runId,
  lang,
  soulLinkId,
  current,
  recorded,
  options,
}: {
  runId: number;
  lang: Lang;
  soulLinkId: number;
  current: number | null;
  // false = never recorded; the control then reads as a prompt rather than
  // as a value that could be changed by accident.
  recorded: boolean;
  options: DeathPointOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = translations[lang].overview;

  function handleChange(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await setDeathPoint(runId, soulLinkId, value === "" ? null : Number(value));
      if (result.success) router.refresh();
      else setError(formatActionError(result.error, lang));
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <select
        value={current ?? ""}
        disabled={pending}
        aria-label={t.deathPoint}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-10 max-w-[15rem] truncate rounded-md border bg-transparent px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
          recorded
            ? "border-line text-ink-muted"
            : "border-dashed border-warning-line text-warning"
        }`}
      >
        <option value="">{recorded ? t.deathPointNone : t.deathPointUnset}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
