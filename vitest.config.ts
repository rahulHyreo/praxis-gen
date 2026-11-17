import { defineConfig } from "vitest/config"

/**
 * Root Vitest config — GLOBAL options only.
 *
 * Projects live in `vitest.workspace.ts`; this file exists because coverage in
 * Vitest is a global concern rather than a per-project one. A `coverage` block
 * written inside a workspace project is silently ignored, which is worth
 * knowing: it reports every file in the repo at 0% and enforces no threshold at
 * all, so the gate looks green while measuring nothing.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      /**
       * Scoped to the v1 flow converter, the only root-level tooling with
       * library code behind its tests. The other root suites assert the
       * CONTENT of config files (`lint-staged.config.mjs`, `docker/`, `docs/`)
       * rather than exercising modules, so they have no source to cover.
       *
       * Per-package coverage is configured and enforced in each package's own
       * `vitest.config.ts` and runs under `turbo test`; this covers only what
       * `pnpm test:root` is responsible for.
       */
      include: ["scripts/convert-v1-flows/lib/**/*.mjs"],
      /**
       * COVERAGE RATCHET — raise these, never lower them.
       *
       * Measured under `pnpm test:root`, which is what `pnpm test` and the git
       * hooks run, across the converter's 162 tests:
       *
       *   statements 97.83   functions 98.68
       *   lines      97.83   branches  86.77
       *
       * Floors sit just under each measurement, so an unrelated edit does not
       * fail the gate on rounding while a real regression does. What remains
       * uncovered is defensive: guards in `verify.mjs` that a conforming pack
       * cannot reach, and a few `??` fallbacks.
       *
       * Branches are lower than the rest because several modules take an
       * options object whose defaults only one caller overrides. When you add a
       * rule, cover both of its directions and raise this floor.
       */
      thresholds: {
        statements: 97,
        functions: 98,
        lines: 97,
        branches: 86,
      },
    },
  },
})
