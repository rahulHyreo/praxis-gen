/**
 * Database seed.
 *
 * Wired end to end — `pnpm db:seed`, the Turbo task, `dev:setup`, the compose
 * seed overlay and the praxis-task container job all reach this file — but it
 * inserts nothing, because this repository has no schema yet (see ./schema.ts;
 * docs/SPEC.md §40 starts the migration set fresh at 0000_init).
 *
 * That is deliberate. Proving the path works while it is trivial means the
 * change that adds the first table adds rows to a seed that already runs,
 * rather than debugging compose wiring and a new table at the same time.
 *
 * It does do one real thing: ensureIdSequences(), which is safe against a
 * database with no tables (every alignment block is guarded by to_regclass —
 * see ./ids.ts) and must run before anything allocates an identifier.
 *
 * NON-DESTRUCTIVE, UNLIKE V1'S. V1's seed TRUNCATEs every application table
 * before inserting, which is why its deploy orchestrator needs a four-rule
 * safety model (SKIP_SEED / FORCE_SEED / SEED_IF_EMPTY / probe-users-table) to
 * avoid wiping live data. V2 does not inherit that: every step added here MUST
 * be idempotent and additive, so a repeated run is a no-op rather than a
 * rewrite. `pnpm db:seed` is run repeatedly against a running local stack and
 * the compose seed overlay runs on every `up`, so anything else would make the
 * seed unsafe to invoke — and §37's append-only doctrine rules out a seed that
 * rewrites existing rows regardless.
 */
import { ensureIdSequences } from "./ids.js"
import { pool } from "./client.js"

/** Apply every seed step. Idempotent: safe to run against a seeded database. */
export async function runSeed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required to seed. Bring the local stack up " +
        "(docker/README.md) or set it in docker/env/.env."
    )
  }

  console.log("[seed] ensuring ID sequences…")
  await ensureIdSequences()

  // No rows to insert yet. Later changes append their steps below, each
  // idempotent — see the header.
  console.log(
    "[seed] no rows to seed: this repository has no schema (SPEC §40). " +
      "ID sequences are ready."
  )
}

const invokedAsScript = process.argv[1]?.endsWith("seed.ts") === true

if (invokedAsScript) {
  runSeed()
    .then(async () => {
      await pool.end()
      process.exit(0)
    })
    .catch(async (error: unknown) => {
      console.error("[seed] failed:", error)
      // Close the pool before exiting so a failure reports the error instead
      // of hanging the process on an open connection.
      await pool.end().catch(() => {})
      process.exit(1)
    })
}
