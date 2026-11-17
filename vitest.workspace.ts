import { defineWorkspace } from "vitest/config"

/**
 * Root Vitest workspace — runs the entire monorepo suite from the repo root
 * (`pnpm exec vitest`). CI and the git hooks use `pnpm test` (Turbo) for
 * per-package caching and the coverage gate; this file is the single-command
 * convenience for local full-suite runs.
 *
 * It also owns the one suite that belongs to no package: the tests for
 * repo-level tooling (`lint-staged.config.mjs`, `scripts/test-staged.mjs`).
 * Those files decide what gets linted and tested, so a mistake in them does
 * not fail a build — it quietly stops checking the right files. `pnpm test`
 * runs that project after the Turbo run so the hooks cover it.
 *
 * NOTE: this file is auto-detected by vitest whenever it runs with the repo
 * root as its cwd, and workspace mode overrides a `--config` passed alongside
 * it. That is why the root tooling project lives here as a named project
 * rather than in a separate root config file.
 */
export default defineWorkspace([
  "apps/api/vitest.config.ts",
  "apps/web/vitest.config.ts",
  "packages/db/vitest.config.ts",
  "packages/shared/vitest.config.ts",
  "packages/ui/vitest.config.ts",
  {
    test: {
      name: "root-tooling",
      globals: true,
      environment: "node",
      include: [
        "*.test.mjs",
        "scripts/**/*.test.mjs",
        "docker/**/*.test.mjs",
        "docs/**/*.test.mjs",
      ],
      poolOptions: { forks: { minForks: 1 } },
    },
  },
])
