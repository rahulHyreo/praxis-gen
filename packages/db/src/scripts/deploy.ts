/**
 * Bring a database up to date: apply pending migrations, then seed.
 *
 *   pnpm --filter @platform/db db:deploy
 *
 * MUCH SIMPLER THAN V1'S, and deliberately so. V1's seed TRUNCATEs every
 * application table before inserting, so its deploy orchestrator needs a
 * four-rule safety model — SKIP_SEED, FORCE_SEED, NODE_ENV=production refusal,
 * SEED_IF_EMPTY, plus a probe of the `users` table to detect a first deploy —
 * entirely to stop a routine deploy wiping live data.
 *
 * V2's seed is additive and idempotent by contract (see ../seed.ts), so there
 * is no destructive act to guard. Running it against a populated database is a
 * no-op, which makes the distinction between "first deploy" and "every other
 * deploy" irrelevant. SKIP_SEED is kept as the one escape hatch, for a database
 * whose rows are managed outside the seed.
 *
 * If a future change needs a destructive seed step, it needs V1's guards back —
 * and should first ask why, since §37 makes graded and audit rows append-only.
 */
import { runMigrations } from "./migrate.js"
import { runSeed } from "../seed.js"
import { pool } from "../client.js"

const SKIP_SEED = ["1", "true", "yes"].includes(
  (process.env.SKIP_SEED ?? "").toLowerCase()
)

async function main(): Promise<void> {
  await runMigrations()

  if (SKIP_SEED) {
    console.log("[deploy] SKIP_SEED set — skipping seed")
    return
  }

  await runSeed()
}

main()
  .then(async () => {
    await pool.end()
    console.log("[deploy] done")
    process.exit(0)
  })
  .catch(async (error: unknown) => {
    console.error("[deploy] failed:", error)
    await pool.end().catch(() => {})
    process.exit(1)
  })
