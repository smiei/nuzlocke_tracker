export function ProgressBar({
  done,
  total,
  percent,
  title,
  size = "sm",
}: {
  done: number;
  total: number;
  percent: number;
  title?: string;
  size?: "sm" | "md";
}) {
  const isMd = size === "md";
  return (
    <div className="flex items-center gap-2" title={title}>
      <div
        className={`overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${
          isMd ? "h-2.5 w-28 sm:w-48" : "h-1.5 w-16 sm:w-28"
        }`}
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`tabular-nums text-zinc-500 dark:text-zinc-400 ${isMd ? "text-sm" : "text-xs"}`}
      >
        {done}/{total} · {percent}%
      </span>
    </div>
  );
}
