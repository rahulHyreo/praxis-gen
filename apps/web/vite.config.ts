import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Polling watcher for environments where inotify does not see host edits.
//
// LOAD-BEARING on this repository's primary platform. WSL2 / DrvFs bind mounts
// do not propagate inotify events into a Linux container, so without polling
// Vite never observes a host edit: the stack starts, reports healthy, and
// silently stops hot-reloading. docker-compose.local.yml sets
// CHOKIDAR_USEPOLLING=true inside the web container for exactly this reason.
const usePolling = process.env.CHOKIDAR_USEPOLLING === "true"
const pollInterval = Number(process.env.CHOKIDAR_INTERVAL ?? 300)

// Where the dev server forwards /api. Keeping the app and the API on one origin
// in development matches how they are served together later, and it is what
// lets a SameSite=Lax session cookie be sent in both. VITE_API_PROXY points it
// at the api container when the web dev server runs on the host.
const apiProxyTarget = process.env.VITE_API_PROXY ?? "http://localhost:3001"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // NOTE: `@workspace/ui` is deliberately NOT aliased here. The package's
      // own `exports` map does the resolution, and it is not a plain
      // directory mapping — `./globals.css` points at `src/styles/globals.css`.
      // An alias rewrites the bare specifier before the exports map is
      // consulted, so `@workspace/ui/globals.css` would resolve to
      // `src/globals.css`, which does not exist, and the build fails on it.
      // vitest.config.ts does alias it, where no stylesheet is imported.
    },
  },
  server: {
    port: 5173,
    proxy: {
      // `changeOrigin: false` keeps the browser's Host header, so a cookie the
      // API sets comes back scoped to the origin the page is actually on
      // (localhost, or a LAN IP when testing from another device).
      "/api": { target: apiProxyTarget, changeOrigin: false },
    },
    watch: usePolling
      ? { usePolling: true, interval: pollInterval }
      : undefined,
  },
})
