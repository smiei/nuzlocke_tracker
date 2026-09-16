import { getGameSummaries } from "@/lib/data";
import { getLang } from "@/lib/i18n/getLang";
import { RunLandingView } from "@/components/RunLandingView";

// Rendered by every run-scoped page when resolveRunId found no run, which only
// a public instance ever reports.
export async function RunLanding() {
  return <RunLandingView lang={await getLang()} games={getGameSummaries()} />;
}
