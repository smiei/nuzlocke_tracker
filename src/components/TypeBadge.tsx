import { TYPE_COLORS, TYPE_LABELS_DE } from "@/lib/pokemonTypes";

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {TYPE_LABELS_DE[type] ?? type}
    </span>
  );
}
