import type { Lang } from "@/lib/i18n/dictionary";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/pokemonTypes";

export function TypeBadge({ type, lang }: { type: string; lang: Lang }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {TYPE_LABELS[lang][type] ?? type}
    </span>
  );
}
