import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // A local WCA Live API does not send CORS headers for the dev server, so in development its
  // requests can go through a same-origin proxy: set VITE_WCA_LIVE_ORIGIN=/wca-live and
  // WCA_LIVE_PROXY_TARGET to the API, e.g. http://localhost:4000.
  const liveProxyTarget = loadEnv(mode, process.cwd(), "").WCA_LIVE_PROXY_TARGET;

  return {
    base: "/CumulativeTracker/",
    plugins: [react()],
    server: liveProxyTarget
      ? {
          proxy: {
            "/wca-live": {
              target: liveProxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/wca-live/, ""),
            },
          },
        }
      : undefined,
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
