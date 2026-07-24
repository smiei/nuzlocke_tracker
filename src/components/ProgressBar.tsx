export function ProgressBar({
  done,
  total,
  percent,
  title,
  size = "sm",
  markerAt,
  markerTitle,
}: {
  done: number;
  total: number;
  percent: number;
  title?: string;
  size?: "sm" | "md";
  // Count (same unit as `total`) at which to draw a small tick on the track,
  // e.g. "everything before the Elite Four" - a fixed reference point
  // distinct from the fill itself.
  markerAt?: number;
  markerTitle?: string;
}) {
  const isMd = size === "md";
  const markerPercent =
    markerAt != null && total > 0 ? Math.min(100, Math.max(0, (markerAt / total) * 100)) : null;
  return (
    <div className="flex items-center gap-2" title={title}>
      <div
        className={`relative overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${
          isMd ? "h-2.5 w-28 sm:w-48" : "h-1.5 w-16 sm:w-28"
        }`}
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${percent}%` }}
        />
        {markerPercent !== null && (
          <div
            title={markerTitle}
            className="absolute inset-y-0 w-px bg-zinc-900/70 dark:bg-white/80"
            style={{ left: `${markerPercent}%` }}
          />
        )}
      </div>
      <span
        className={`tabular-nums text-zinc-500 dark:text-zinc-400 ${isMd ? "text-sm" : "text-xs"}`}
      >
        {done}/{total} · {percent}%
      </span>
    </div>
  );
}
