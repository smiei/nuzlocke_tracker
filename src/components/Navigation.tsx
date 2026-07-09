"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const run = searchParams.get("run");

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const href = item.runScoped && run ? `${item.href}?run=${run}` : item.href;
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
