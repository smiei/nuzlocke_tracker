"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const run = searchParams.get("run");
  const { lang } = useLanguage();
  const { order } = useTabOrder();
  const t = translations[lang].nav;

  const items = order
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined);

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const href = run ? `${item.href}?run=${run}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {t[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
