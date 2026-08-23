"use client";

import { useEffect } from "react";

// Registers public/sw.js, which caches only immutable sprite/badge/icon
// requests (see the header comment there).
//
// Production only, deliberately: a worker squatting on localhost:3000 during
// `next dev` intercepts HMR chunk requests and produces baffling stale-module
// errors. Test the worker with `npm run build && npm start` instead.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // updateViaCache: "none" stops the browser serving sw.js out of its own
    // HTTP cache when it checks for an update.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Behind Cloudflare Access an expired session answers the script
        // request with a login redirect. Nothing to do but leave whatever
        // worker is already installed in place and retry on the next load.
      });
    };

    // Registering during load competes with the page's own requests for
    // bandwidth, which on a phone over the tunnel is exactly the wrong trade.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
