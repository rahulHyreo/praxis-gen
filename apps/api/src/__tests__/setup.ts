import { beforeEach } from "vitest"

/**
 * Shared test setup for apps/api.
 *
 * Most suites here need no database: §43 forbids a live one in a unit test, so
 * they mock `@platform/db` instead. A suite that genuinely needs Postgres gates
 * on `hasTestDb()` / `requireTestDb()` and is skipped when none is attached:
 *
 *     describe.skipIf(!hasTestDb())("...", () => { ... })
 *
 * Those two names are also how `vitest.db.config.ts` DISCOVERS database-backed
 * suites — by content, so adding one needs no list kept in step. Do not rename
 * them without updating that config.
 *
 * Under `pnpm test:db` the PGlite harness sets TEST_DATABASE_URL to an
 * in-memory Postgres, so the same files run for real with no Docker and no
 * installed Postgres.
 */

export function hasTestDb(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL)
}

/** Throw unless a test database is attached. For a suite that cannot skip. */
export function requireTestDb(): string {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is required for this suite. Run `pnpm test:db`, " +
        "which provides an in-memory PGlite database."
    )
  }
  return url
}

// Point the pool at the test database BEFORE anything can capture the old
// value.
//
// LOAD-BEARING AT MODULE SCOPE, not in a hook. packages/db/src/client.ts reads
// process.env.DATABASE_URL at MODULE scope, and a test file's static imports
// are evaluated before any beforeAll runs — so assigning it inside beforeAll
// would be too late. In V1 that mistake was masked because every test file
// shared one worker process, where the first file's beforeAll left the variable
// set for all the rest; this config gives each file its own fork (see
// vitest.config.ts), so there is no cross-file leak to rely on. Vitest imports
// a setup file before the test file it is setting up, which makes module scope
// here the one place reliably early enough.
if (hasTestDb()) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

/**
 * Reset the database between tests.
 *
 * Tables are DISCOVERED from information_schema rather than listed. V1 keeps a
 * hand-ordered list of ~45 table names, which has to be edited with every
 * migration and silently stops resetting a table someone forgets to add — a
 * failure mode that shows up as a mysterious cross-test dependency. `TRUNCATE
 * ... CASCADE` handles referential order itself, so the list bought nothing.
 *
 * Drizzle's own migration bookkeeping is excluded: truncating it would make the
 * migrator re-apply every migration against a schema that already has them.
 *
 * Does nothing when no test database is attached, which is the common case.
 */
beforeEach(async () => {
  if (!hasTestDb()) return

  const { db } = await import("@platform/db")
  const { sql } = await import("drizzle-orm")

  const result = await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
  `)
  const rows = (result as unknown as { rows: { tablename: string }[] }).rows
  const tables = rows.map((r) => r.tablename)

  if (tables.length > 0) {
    const list = tables.map((t) => `"${t}"`).join(", ")
    await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`))
  }

  // RESTART IDENTITY resets serial columns but not the standalone sequences
  // ids.ts creates, so re-establish them after every reset.
  const { ensureIdSequences } = await import("@platform/db")
  await ensureIdSequences()
})
