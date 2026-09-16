// Which kind of deployment this build is, client-safe.
//
// "private" (the default, and what every Docker image is): one group's own
// server. Every run is listed to everyone, live sync runs over SSE, sprites
// are served from the container's volume, rule presets are shared.
//
// "public" (NEXT_PUBLIC_INSTANCE_MODE=public, set on the Vercel project):
// open to anybody. A run is only reachable through its access key - there is
// no list of all runs and no fallback onto somebody else's - the browser
// polls Run.version instead of holding a live connection, and sprites are
// hotlinked from PokeAPI instead of being served by the deployment.
//
// One NEXT_PUBLIC_ variable rather than a server/client pair: Next inlines it
// into both bundles at build time, so the two halves can never disagree.
export const IS_PUBLIC_INSTANCE = process.env.NEXT_PUBLIC_INSTANCE_MODE === "public";
