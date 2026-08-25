"use client";

import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Modal for reordering the nav tabs; opened from the header menu.
export function TabOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { order, setOrder, hidden, toggleHidden, reset, isDefault } = useTabOrder();
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
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      footer={
        <div className="flex w-full justify-between gap-2">
          <Button size="sm" disabled={isDefault} onClick={reset}>
            {t.reset}
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            {t.done}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-ink-subtle">{t.visibilityHint}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => {
          const isHidden = hidden.includes(item.href);
          return (
            <li
              key={item.href}
              className={`flex items-center justify-between gap-2 rounded-md border border-line px-3 py-1.5 text-sm ${
                isHidden ? "opacity-50" : ""
              }`}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(item.href)}
                  aria-label={isHidden ? t.show : t.hide}
                  className="accent-success"
                />
                <span className="truncate text-ink">{tNav[item.labelKey]}</span>
              </label>
              <span className="flex gap-1">
                {/* 40px each: these were ~20px, the smallest targets in the app
                    and the ones you tap repeatedly to reorder a list. */}
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t.moveUp}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-xs text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t.moveDown}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-xs text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
