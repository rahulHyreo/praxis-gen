/**
 * Programmatic Drizzle migration runner.
 *
 * Why programmatic rather than `drizzle-kit migrate`:
 *   - No CLI tool needed at runtime (drizzle-kit is a devDependency, and the
 *     api image does not install dev dependencies).
 *   - It can retry until Postgres is reachable, which is the most common
 *     boot-time race in a compose stack: the api or a one-shot job starts
 *     before Postgres has finished its first-run initialisation.
 *
 * Usage:
 *   pnpm --filter @platform/db db:migrate:run
 *   tsx src/scripts/migrate.ts
 *
 * Applies nothing today — packages/db/drizzle holds no migration yet (§40
 * starts the set fresh at 0000_init). Wiring it now means the change that adds
 * the first migration finds a runner that already works.
 */
// Loads .env before DATABASE_URL is read below. Container/CI/shell env vars
// always win over .env files — see ../env.ts for the priority model.
import "../env.js"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required")
  process.exit(1)
}

const thisFile = fileURLToPath(import.meta.url)
// src/scripts/migrate.ts → ../../drizzle (== packages/db/drizzle)
const MIGRATIONS_FOLDER = resolve(dirname(thisFile), "../../drizzle")

const MAX_ATTEMPTS = Number(process.env.DB_WAIT_RETRIES ?? 30)
const RETRY_DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS ?? 1000)

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const probe = new Client({ connectionString: databaseUrl })
    try {
      await probe.connect()
      await probe.query("SELECT 1")
      await probe.end()
      if (attempt > 1) {
        console.log(`[migrate] database reachable on attempt ${attempt}`)
      }
      return
    } catch (err) {
      await probe.end().catch(() => {
        // already closed; nothing to do
      })
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `[migrate] database unreachable after ${MAX_ATTEMPTS} attempts`
        )
        throw err
      }
      console.log(
        `[migrate] DB not ready (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_DELAY_MS}ms…`
      )
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}

export async function runMigrations(): Promise<void> {
  // Drizzle's migrator THROWS "Can't find meta/_journal.json file" when no
  // migration has ever been generated. That is the current state of this
  // repository by design — §40 starts the migration set fresh at 0000_init —
  // so treating it as a failure would make `praxis-task migrate`,
  // `pnpm db:migrate:run` and the compose seed job all fail until the first
  // migration lands, and the seed job (which chains with &&) would never run.
  //
  // Checked rather than caught: an absent journal is a known, expected state,
  // whereas a corrupt one or an unreadable directory is a real fault that must
  // still surface.
  if (!existsSync(resolve(MIGRATIONS_FOLDER, "meta", "_journal.json"))) {
    console.log(
      `[migrate] no migrations in ${MIGRATIONS_FOLDER} — nothing to apply. ` +
        "Generate the first one with `pnpm db:generate` (see SPEC §40)."
    )
    return
  }

  await waitForDatabase()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const db = drizzle(client)
    console.log(`[migrate] applying migrations from ${MIGRATIONS_FOLDER}`)
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    console.log("[migrate] migrations applied")
  } finally {
    await client.end()
  }
}

const invokedAsScript = process.argv[1] ? process.argv[1] === thisFile : false

if (invokedAsScript) {
  runMigrations().catch((err) => {
    console.error("[migrate] failed:", err)
    process.exit(1)
  })
}
