// Vitest globalSetup for the DB-backed api suites (vitest.db.config.ts).
//
// Builds the test database ONCE per run: an in-memory PGlite (Postgres compiled
// to WASM, running inside this process) with every packages/db/drizzle
// migration applied, then saves its data directory to a temp file. Each test
// file's fork boots its own copy from that file (./setup.ts), so files never
// share a database and can run side by side, and no file pays for the
// migrations again.
//
// Nothing to install or configure: no Docker, no Postgres, no
// TEST_DATABASE_URL. Set TEST_DATABASE_URL yourself to run the same suites
// against a real Postgres instead; this then does nothing (see ./setup.ts).
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { GlobalSetupContext } from "vitest/node"

import { createMigratedDatabase } from "./migrations"

declare module "vitest" {
  export interface ProvidedContext {
    /** Path of the migrated PGlite data dir, or "" when a real DB is used. */
    pgliteSnapshot: string
  }
}

export default async function setup({
  provide,
}: GlobalSetupContext): Promise<(() => Promise<void>) | undefined> {
  if (process.env.TEST_DATABASE_URL) {
    provide("pgliteSnapshot", "")
    return undefined
  }

  const started = Date.now()
  const { db, migrations } = await createMigratedDatabase()
  const dump = await db.dumpDataDir("none")
  await db.close()

  const dir = await mkdtemp(join(tmpdir(), "praxis2-pglite-"))
  const file = join(dir, "migrated.tar")
  await writeFile(file, Buffer.from(await dump.arrayBuffer()))
  provide("pgliteSnapshot", file)
  console.log(
    `[pglite] test database ready: ${migrations} migration(s) in ${Date.now() - started} ms`
  )

  return async () => {
    await rm(dir, { recursive: true, force: true })
  }
}
