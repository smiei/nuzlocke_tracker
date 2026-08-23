"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { NavIcon } from "@/components/NavIcon";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const run = searchParams.get("run");
  const { lang } = useLanguage();
  const { order, hidden } = useTabOrder();
  const t = translations[lang].nav;

  const items = order
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined)
    .filter((item) => !hidden.includes(item.href));

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const href = run ? `${item.href}?run=${run}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            // Icon over label: eight near-identical text labels are slow to
            // pick out, a shape is recognised without reading. The icon takes
            // its colour from the link, so the active/inactive states below
            // still drive everything.
            className={`flex min-w-16 shrink-0 flex-col items-center gap-1 whitespace-nowrap border-b-2 px-3 pt-2 pb-2 text-xs font-medium transition-colors ${
              isActive
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <NavIcon href={item.href} className="h-5 w-5" />
            {t[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
