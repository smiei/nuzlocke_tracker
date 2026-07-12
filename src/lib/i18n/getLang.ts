import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n/dictionary";

// Only for pages that are already force-dynamic (tracker/links/levelcaps) -
// cookies() is a request-time API and reading it anywhere in a route (even
// Suspense-wrapped) forces that whole route out of static rendering, unlike
// useSearchParams() in a Client Component. Never call this from layout.tsx
// or the pokedex/typen pages, or they'd lose static prerendering.
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isLang(value) ? value : "de";
}
