import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The Team-Weaknesses tab was absorbed into the Overview tab (defensive +
// offensive coverage live there now). Keep the route as a redirect so old
// links/bookmarks still work.
export default async function WeaknessesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  redirect(run ? `/overview?run=${run}` : "/overview");
}
