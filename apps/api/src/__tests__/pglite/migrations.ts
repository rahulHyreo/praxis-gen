// Applies every packages/db/drizzle migration, in journal order, to a fresh
// in-memory PGlite.
//
// Statements are applied ONE AT A TIME, not as one batch. That is deliberate:
// a migration may add an enum value and use it in the next statement, which
// Postgres only allows once the first has committed.
//
// This repository currently has NO migrations — docs/SPEC.md §40 starts the set
// fresh at 0000_init — so a run here produces an empty database and reports 0
// migrations. That is a valid state, not an error: the harness has to work
// before the first migration exists, or the change that adds it would be
// building the test database and the schema at the same time.
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../../packages/db/drizzle/", import.meta.url)
)

interface Journal {
  entries: { tag: string }[]
}

async function readJournal(): Promise<Journal> {
  try {
    const text = await readFile(`${MIGRATIONS_DIR}meta/_journal.json`, "utf8")
    return JSON.parse(text) as Journal
  } catch (err) {
    // ENOENT means drizzle-kit has never generated a migration here. Any other
    // failure — malformed JSON, a permissions problem — is a real fault and
    // must not be silently treated as "no migrations", which would hand every
    // suite an empty database and fail far from the cause.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { entries: [] }
    }
    throw err
  }
}

export async function createMigratedDatabase(): Promise<{
  db: PGlite
  migrations: number
}> {
  const journal = await readJournal()
  const db = await PGlite.create()

  for (const { tag } of journal.entries) {
    const text = await readFile(`${MIGRATIONS_DIR}${tag}.sql`, "utf8")
    const statements = text
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const statement of statements) {
      try {
        await db.exec(statement)
      } catch (err) {
        await db.close()
        throw new Error(
          `[pglite] migration ${tag} failed: ${(err as Error).message}\n` +
            statement.slice(0, 300)
        )
      }
    }
  }

  return { db, migrations: journal.entries.length }
}
