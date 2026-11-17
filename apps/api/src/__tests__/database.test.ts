import { afterAll, describe, expect, it } from "vitest"
import { sql } from "drizzle-orm"

import { hasTestDb, requireTestDb } from "./setup.js"

/**
 * Proves the PGlite harness, and makes the live-database assertions that
 * packages/db's unit tests deliberately cannot.
 *
 * Those tests mock the db client and assert the SQL `ids.ts` ISSUES (§43: no
 * live database in a unit test). What they cannot show is that the SQL is
 * CORRECT — that `CREATE SEQUENCE IF NOT EXISTS` really is idempotent against
 * Postgres, that the `to_regclass` guard really does skip a missing table
 * rather than erroring, and that `nextval` really hands back consecutive
 * values. Those need a database, and this is where it exists.
 *
 * Skipped by `pnpm test` (no TEST_DATABASE_URL); run by `pnpm test:db`.
 */
// FILE-SCOPED, not inside a describe. An afterAll registered within a describe
// runs when THAT block finishes, which closed the pool before the later blocks
// in this file had run ("Cannot use a pool after calling end on the pool").
// At file scope it runs once, after every block.
//
// The PGlite socket is stopped after this, by pglite/setup.ts — its afterAll
// was registered first and after-hooks run in reverse.
afterAll(async () => {
  if (!hasTestDb()) return
  const { pool } = await import("@platform/db")
  await pool.end()
})

describe.skipIf(!hasTestDb())("the test database", () => {
  it("is reachable", async () => {
    requireTestDb()
    const { db } = await import("@platform/db")
    const result = await db.execute<{ one: number }>(sql`SELECT 1 AS one`)
    const rows = (result as unknown as { rows: { one: number }[] }).rows
    expect(Number(rows[0].one)).toBe(1)
  })

  it("is real Postgres, not an emulation", async () => {
    const { db } = await import("@platform/db")
    const result = await db.execute<{ version: string }>(
      sql`SELECT version() AS version`
    )
    const rows = (result as unknown as { rows: { version: string }[] }).rows
    expect(rows[0].version).toContain("PostgreSQL")
  })

  it("has no application tables yet", async () => {
    // §40 starts the migration set fresh, so the migrated database is empty.
    // This asserts the harness reports that honestly rather than silently
    // handing back some other database.
    const { db } = await import("@platform/db")
    const result = await db.execute<{ count: string }>(sql`
      SELECT count(*) AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'
    `)
    const rows = (result as unknown as { rows: { count: string }[] }).rows
    expect(Number(rows[0].count)).toBe(0)
  })

  it("points the app's own pool at itself, not at a developer's database", async () => {
    // setup.ts assigns DATABASE_URL from TEST_DATABASE_URL at module scope,
    // before any import can capture the old value.
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL)
  })

  it("cannot be reached by a developer's .env", () => {
    // vitest.db.config.ts pins these, and a real environment variable always
    // beats a .env file (packages/db/src/env.ts). Without the pin, whatever a
    // developer happens to have in docker/env/.env or a root .env would change
    // what these suites see — so a suite could pass on one machine and fail on
    // another for reasons nothing in the repository records.
    expect(process.env.REDIS_URL).toBe("")

    // And the database is this run's PGlite, never a URL from a file.
    expect(process.env.DATABASE_URL).toContain("127.0.0.1")
  })
})

describe.skipIf(!hasTestDb())(
  "ensureIdSequences against a real database",
  () => {
    it("creates every declared sequence", async () => {
      const { ensureIdSequences, ID_SEQUENCES } = await import("@platform/db")
      const { db } = await import("@platform/db")

      await ensureIdSequences()

      for (const name of Object.values(ID_SEQUENCES)) {
        const result = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_class
          WHERE relkind = 'S' AND relname = ${name}
        ) AS exists
      `)
        const rows = (result as unknown as { rows: { exists: boolean }[] }).rows
        expect(rows[0].exists, `${name} should exist`).toBe(true)
      }
    })

    it("is genuinely idempotent — a second call does not throw", async () => {
      // The unit test can only assert the SQL says IF NOT EXISTS. This asserts
      // Postgres agrees, which is the claim that matters when the seed runs on
      // every `docker compose up`.
      const { ensureIdSequences } = await import("@platform/db")
      await ensureIdSequences()
      await expect(ensureIdSequences()).resolves.toBeUndefined()
    })

    it("survives a database with none of the tables it aligns against", async () => {
      // This is the real test of the to_regclass guard. A bare reference to a
      // missing table in FROM fails at PARSE time, so without the DO-block guard
      // this throws here — and it would throw on every fresh database, which is
      // exactly the state this repository is in (§40).
      const { alignIdSequences } = await import("@platform/db")
      await expect(alignIdSequences()).resolves.toBeUndefined()
    })
  }
)

describe.skipIf(!hasTestDb())("identifier allocation", () => {
  it("hands out consecutive trainee ids in the §40 format", async () => {
    const { ensureIdSequences, nextTraineeId } = await import("@platform/db")
    await ensureIdSequences()

    const first = await nextTraineeId()
    const second = await nextTraineeId()

    expect(first).toMatch(/^HYTE-\d{5,}$/)
    expect(second).toMatch(/^HYTE-\d{5,}$/)

    const n = (id: string) => Number(id.slice("HYTE-".length))
    expect(n(second)).toBe(n(first) + 1)
  })

  it("hands out consecutive trainer ids in the §40 format", async () => {
    const { ensureIdSequences, nextTrainerId } = await import("@platform/db")
    await ensureIdSequences()

    const first = await nextTrainerId()
    const second = await nextTrainerId()

    expect(first).toMatch(/^CRTR-\d{5,}$/)
    const n = (id: string) => Number(id.slice("CRTR-".length))
    expect(n(second)).toBe(n(first) + 1)
  })

  it("never issues the same id twice under concurrent allocation", async () => {
    // A sequence is the reason identifiers are allocated this way rather than
    // with max(id) + 1, which races. Twenty parallel callers must get twenty
    // distinct values.
    const { ensureIdSequences, nextTraineeId } = await import("@platform/db")
    await ensureIdSequences()

    const ids = await Promise.all(
      Array.from({ length: 20 }, () => nextTraineeId())
    )
    expect(new Set(ids).size).toBe(20)
  })
})

describe.skipIf(!hasTestDb())("the seed", () => {
  it("runs against an empty database and reports success", async () => {
    // `pnpm db:seed`, `dev:setup` and the compose seed overlay all reach this.
    // Proving it works while it is trivial means the change that adds the
    // first table is not debugging compose wiring at the same time.
    const { runSeed } = await import("@platform/db/seed")
    await expect(runSeed()).resolves.toBeUndefined()
  })

  it("is idempotent — running it twice is a no-op, not a conflict", async () => {
    // The compose seed overlay runs on every `up`, so this is a hard
    // requirement, not a nicety (see packages/db/src/seed.ts).
    const { runSeed } = await import("@platform/db/seed")
    await runSeed()
    await expect(runSeed()).resolves.toBeUndefined()
  })
})
