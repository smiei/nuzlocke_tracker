"use client";

import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

function ArrangeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 15v6m0 0-2.5-2.5M19 21l2.5-2.5" />
    </svg>
  );
}

export function TabOrderButton() {
  const [open, setOpen] = useState(false);
  const { order, setOrder, reset, isDefault } = useTabOrder();
  const { lang } = useLanguage();
  const t = translations[lang].tabOrder;
  const tNav = translations[lang].nav;

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.label}
        title={t.label}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ArrangeIcon className="h-5 w-5" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h2 className="mb-3 text-base font-semibold">{t.title}</h2>
            <ul className="mb-4 flex flex-col gap-1">
              {items.map((item, i) => (
                <li
                  key={item.href}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-800"
                >
                  <span>{tNav[item.labelKey]}</span>
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
              ))}
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
                onClick={() => setOpen(false)}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
