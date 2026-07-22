"use client";

import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

// Modal for reordering the nav tabs; opened from the header menu.
export function TabOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { order, setOrder, hidden, toggleHidden, reset, isDefault } = useTabOrder();
  const { lang } = useLanguage();
  const t = translations[lang].tabOrder;
  const tNav = translations[lang].nav;

  if (!open) return null;

  const items = order
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined);

  function move(index: number, delta: -1 | 1) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-1 text-base font-semibold">{t.title}</h2>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">{t.visibilityHint}</p>
        <ul className="mb-4 flex flex-col gap-1">
          {items.map((item, i) => {
            const isHidden = hidden.includes(item.href);
            return (
              <li
                key={item.href}
                className={`flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-800 ${
                  isHidden ? "opacity-50" : ""
                }`}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggleHidden(item.href)}
                    aria-label={isHidden ? t.show : t.hide}
                    className="accent-emerald-500"
                  />
                  <span className="truncate">{tNav[item.labelKey]}</span>
                </label>
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t.moveUp}
                    className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t.moveDown}
                    className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    ▼
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            disabled={isDefault}
            onClick={reset}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t.reset}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
