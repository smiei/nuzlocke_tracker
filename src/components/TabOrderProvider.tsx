"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { usePersistentState } from "@/lib/usePersistentState";

const ORDER_KEY = "nuzlocke:tabOrder";
const HIDDEN_KEY = "nuzlocke:tabHidden";
const DEFAULT_ORDER = NAV_ITEMS.map((item) => item.href);
const KNOWN = new Set<string>(DEFAULT_ORDER);

// Drops unknown hrefs (removed tabs) and appends missing ones in default
// order (newly added tabs), so a stored order never hides a tab.
function normalize(order: string[]): string[] {
  const known = order.filter((href) => KNOWN.has(href));
  const missing = DEFAULT_ORDER.filter((href) => !known.includes(href));
  return [...known, ...missing];
}

function normalizeHidden(hidden: string[]): string[] {
  return [...new Set(hidden.filter((href) => KNOWN.has(href)))];
}

type TabOrderApi = {
  order: string[];
  setOrder: (order: string[]) => void;
  hidden: string[];
  toggleHidden: (href: string) => void;
  reset: () => void;
  isDefault: boolean;
};

const TabOrderContext = createContext<TabOrderApi | null>(null);

export function useTabOrder(): TabOrderApi {
  const ctx = useContext(TabOrderContext);
  if (!ctx) throw new Error("useTabOrder must be used within a TabOrderProvider");
  return ctx;
}

// Personal UI preference, so it lives in localStorage (per browser) - same
// treatment as the sort preference on the Pokémon tab. usePersistentState is
// SSR-safe: the default order/visibility renders on the server, the stored
// values apply during hydration.
export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [rawOrder, setRawOrder] = usePersistentState<string[]>(ORDER_KEY, DEFAULT_ORDER);
  const [rawHidden, setRawHidden] = usePersistentState<string[]>(HIDDEN_KEY, []);
  const order = useMemo(() => normalize(rawOrder), [rawOrder]);
  const hidden = useMemo(() => normalizeHidden(rawHidden), [rawHidden]);

  const setOrder = useCallback((next: string[]) => setRawOrder(normalize(next)), [setRawOrder]);

  const toggleHidden = useCallback(
    (href: string) =>
      setRawHidden((prev) =>
        normalizeHidden(prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]),
      ),
    [setRawHidden],
  );

  const reset = useCallback(() => {
    setRawOrder(DEFAULT_ORDER);
    setRawHidden([]);
  }, [setRawOrder, setRawHidden]);

  const api = useMemo(
    () => ({
      order,
      setOrder,
      hidden,
      toggleHidden,
      reset,
      isDefault: order.join() === DEFAULT_ORDER.join() && hidden.length === 0,
    }),
    [order, setOrder, hidden, toggleHidden, reset],
  );

  return <TabOrderContext.Provider value={api}>{children}</TabOrderContext.Provider>;
}
