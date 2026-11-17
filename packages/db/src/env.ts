/**
 * Centralized environment loader — the single place `.env` files are read.
 *
 * Priority model — highest wins, lowest is the last-resort fallback:
 *
 *   1. Real process environment — variables injected by the container
 *      (compose `environment:` / `env_file:`) or the shell. This is the source
 *      of truth whenever the app runs in the local stack.
 *   2. Repo-root `.env`         — host-mode fallback for `pnpm dev`, tsx
 *      scripts and drizzle-kit, when no container has supplied the variable.
 *   3. Package-local `.env`     — optional per-package fallback (lowest).
 *
 * dotenv is invoked with `override: false`, so a variable already present in
 * `process.env` is NEVER replaced by a file — the files only fill gaps. That is
 * dotenv's default, but it is passed explicitly so the guarantee is
 * self-documenting and flipping it is an obvious regression in review. A test
 * asserts it (./env.test.ts).
 *
 * The rule is uniform across every variable: there is no per-variable
 * special-casing anywhere in this module, and none should be added. A named
 * exception would be a second, invisible configuration model competing with
 * the layered env files that docs/SPEC.md §42 defines.
 *
 * Idempotent: importing this module from any number of entry points in one
 * process loads the files exactly once.
 */
import { config as dotenvConfig } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

let loaded = false

/**
 * Walk upward from `start` until the directory containing `pnpm-workspace.yaml`
 * (the monorepo root) is found. Returns `undefined` when no root is reachable —
 * e.g. when this module has been bundled into a temp dir by drizzle-kit/esbuild.
 */
function findRepoRoot(start: string): string | undefined {
  let dir = start
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Load `.env` files into `process.env` without overriding variables that are
 * already set. Safe to call any number of times -only the first call works.
 */
export function loadEnv(): void {
  if (loaded) return
  loaded = true

  const cwd = process.cwd()
  let repoRoot: string | undefined
  try {
    repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
  } catch {
    // A defensive fallback that cannot be triggered from a test, and the one
    // uncovered branch in this package. `import.meta.url` is always a file URL
    // when this module is loaded by Node or Bun; it is not in some bundled
    // contexts (drizzle-kit/esbuild can inline this module into a temp dir),
    // and the cwd-relative candidates below are then the only way to reach the
    // env files. Left uncovered deliberately — see the ratchet note in
    // vitest.config.ts.
    repoRoot = undefined
  }

  // Highest-priority file first. With `override: false` the first file to
  // define a key wins, and a real env var still beats every file. The
  // cwd-relative entries keep drizzle-kit (cwd = packages/db) and the db
  // scripts working even when the repo root cannot be discovered.
  //
  // The docker/env/* layers are read too, in the same order compose applies
  // them (.env → <env>.env → base.env, earlier winning here because the first
  // file to define a key wins). That makes docker/env/ the SINGLE place
  // configuration lives for both container and host mode: `pnpm db:studio`,
  // `drizzle-kit` and a plain `pnpm dev` see the same values the containers
  // do, without a second copy at the repo root to keep in step.
  //
  // Without this, host-mode tooling fails with "DATABASE_URL is required" even
  // though the stack is up and configured — and the error message pointing at
  // docker/env/.env would be advice about a file nothing read.
  const appEnv = process.env.APP_ENV ?? "local"
  const dockerEnvDirs = [
    repoRoot ? resolve(repoRoot, "docker", "env") : undefined,
    // cwd-relative fallbacks, for the same reason as the .env entries below.
    resolve(cwd, "../../docker/env"),
    resolve(cwd, "docker/env"),
  ].filter((dir): dir is string => Boolean(dir))

  const candidates = [
    repoRoot ? resolve(repoRoot, ".env") : undefined,
    resolve(cwd, "../../.env"),
    resolve(cwd, ".env"),
    ...dockerEnvDirs.flatMap((dir) => [
      resolve(dir, ".env"),
      resolve(dir, `${appEnv}.env`),
      resolve(dir, "base.env"),
    ]),
  ].filter((path): path is string => Boolean(path))

  const seen = new Set<string>()
  for (const path of candidates) {
    if (seen.has(path)) continue
    seen.add(path)
    // override:false -never replace a var already in process.env.
    // quiet:true     -suppress dotenv's per-file tip logs.
    dotenvConfig({ path, override: false, quiet: true })
  }
}

// Auto-load on import so a bare `import "@platform/db/env"` is sufficient.
loadEnv()
