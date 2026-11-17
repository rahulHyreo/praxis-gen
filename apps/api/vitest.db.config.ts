import { readdirSync, readFileSync } from "node:fs"
import { availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

import base from "./vitest.config"

// The DB-backed api suites, on a database that needs no setup:
//
//   pnpm --filter @platform/api test:db      (or `pnpm test:db` from the root)
//
// Every suite that gates on `hasTestDb()` / `requireTestDb()` runs against an
// in-memory PGlite: real Postgres, compiled to WASM, inside the test process.
// No Docker, no Postgres install, no TEST_DATABASE_URL. src/__tests__/pglite/
// builds it from packages/db/drizzle once per run and gives each test file its
// own copy, so files run side by side. `vitest.config.ts` (`pnpm test`, the
// coverage gate) runs the same files with those suites skipped.
//
// The git pre-push hook runs this after `pnpm test`; the pre-commit hook runs
// the part of it related to the staged files (scripts/test-staged.mjs).
//
// TEST_DATABASE_URL set: the suites run against that Postgres instead, one file
// at a time, because src/__tests__/setup.ts resets its tables between tests.

const root = fileURLToPath(new URL(".", import.meta.url))
const DB_GATE = /\b(?:hasTestDb|requireTestDb)\b/
// A file that replaces the db client for the whole file can never reach a
// database; its DB-free tests already run in `pnpm test`.
const MOCKS_DB = /vi\.mock\(\s*["']@platform\/db["']/

// Found BY CONTENT, so a new DB-backed suite needs no list kept in step. A
// list would silently omit a suite someone forgets to add, and the symptom —
// a test that never runs — is invisible.
function dbSuites(): string[] {
  return (readdirSync(`${root}src`, { recursive: true }) as string[])
    .map((file) => `src/${file.split("\\").join("/")}`)
    .filter((file) => file.endsWith(".test.ts"))
    .filter((file) => {
      const text = readFileSync(`${root}${file}`, "utf8")
      return DB_GATE.test(text) && !MOCKS_DB.test(text)
    })
    .sort()
}

const ownDatabase = Boolean(process.env.TEST_DATABASE_URL)
const maxForks = ownDatabase
  ? 1
  : Number(process.env.VITEST_MAX_FORKS) ||
    Math.max(1, Math.min(4, availableParallelism() - 1))

const baseTest = base.test ?? {}

export default defineConfig({
  ...base,
  test: {
    ...baseTest,
    include: dbSuites(),
    globalSetup: ["./src/__tests__/pglite/global-setup.ts"],
    setupFiles: ["./src/__tests__/pglite/setup.ts", "./src/__tests__/setup.ts"],
    // The setup hooks boot a WASM Postgres on first use.
    hookTimeout: 60_000,
    // Fixed, so a developer's .env cannot change what these suites see (a real
    // variable always beats .env — see packages/db/src/env.ts). The database is
    // new on every run.
    env: {
      ...baseTest.env,
      REDIS_URL: "",
    },
    poolOptions: {
      ...baseTest.poolOptions,
      forks: { ...baseTest.poolOptions?.forks, maxForks },
    },
    // The coverage gate stays on `pnpm test`; this run only adds assertions.
    coverage: { ...baseTest.coverage, enabled: false },
  },
})
