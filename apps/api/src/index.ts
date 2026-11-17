// Load .env explicitly and first — before any module reads process.env at
// import time. Container/shell env vars win; .env is only the fallback. See
// packages/db/src/env.ts for the priority model.
import "@platform/db/env"

import { createServer } from "./server.js"

const port = Number(process.env.PORT ?? 3001)

async function main(): Promise<void> {
  // NOTE: ensureIdSequences() is deliberately NOT called here yet. It issues
  // CREATE SEQUENCE against the database, and this api must start and answer
  // /api/health with no database configured (§44) — the container healthcheck
  // depends on that. The seed and deploy scripts own sequence creation for now
  // (packages/db/src/seed.ts); the change that first allocates an identifier at
  // runtime decides whether boot should ensure them too.

  const app = createServer()
  const server = app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`)
  })

  // The container runtime sends SIGTERM and waits before SIGKILL. Stop
  // accepting connections and let in-flight requests drain rather than cutting
  // them off mid-response.
  //
  // Later changes add their own teardown here — the Redis cache client, the
  // scheduled jobs of §44 — each of which must be stopped before exit.
  let shuttingDown = false
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[api] ${signal} received — shutting down`)
    server.close(() => process.exit(0))
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((err) => {
  console.error("[api] failed to start:", err)
  process.exit(1)
})
