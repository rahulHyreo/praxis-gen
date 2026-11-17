import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Vitest reads VITEST_MAX_FORKS itself and turns it into maxForks. Left
    // unset, minForks defaults to CPUs - 1, so on a bigger machine min > max
    // and the pool refuses to start ("minThreads and maxThreads must not
    // conflict") before a single test runs. A floor of 1 is valid for any
    // maxForks. Same as apps/api.
    poolOptions: { forks: { minForks: 1 } },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/test/**",
        // scripts/ are deployment entry points whose bodies run a live
        // database; their logic is exercised by bringing the stack up
        // (task 13.12), not by unit tests.
        "src/scripts/**",
        // schema.ts is declarative Drizzle DDL — and currently empty (§40).
        // seed.ts is an imperative script against a live database; its real
        // run is an integration concern, not a unit one.
        "src/schema.ts",
        "src/seed.ts",
        // client.ts constructs a connection pool at import time. Importing it
        // under coverage would open sockets from the test process; the pool's
        // configuration is asserted indirectly through ids.ts's mocked client.
        "src/client.ts",
        // index.ts is a three-line barrel that re-exports client.ts, so
        // covering it means importing the pool — the very thing excluded
        // above. It is exercised for real by the api's PGlite suite, which
        // imports `@platform/db` against a live database.
        //
        // Note the asymmetry with packages/shared, whose index.ts IS covered:
        // nothing it re-exports has an import-time side effect, so a test can
        // import the barrel and assert the public surface. Where that is
        // possible it is the better option.
        "src/index.ts",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
      // COVERAGE RATCHET — raise these, never lower them.
      //
      // Measured TWICE under `pnpm test` — the command the git hooks and CI run —
      // with Turbo's cache cleared between runs. Both readings were identical.
      // Reading: 97.14 / 88 / 100 / 97.14.
      //
      // The uncovered remainder is env.ts's fallback for an unavailable
      // import.meta.url, which cannot be triggered from a test. Functions sit at
      // 99 rather than 100 to leave one function of room as this package grows.
      //
      // RE-MEASURED after env.ts gained the docker/env layers: 97.53 / 87.09 /
      // 100 / 97.53. Branches fell from 88 to 87.09 because that change added
      // the APP_ENV selection and the repo-root guard; three tests were added
      // to execute both paths of each rather than lowering this floor. The
      // branch margin is thin (0.09) but the reading is deterministic — a node
      // suite with no jsdom and no timing, identical across runs — so the
      // headroom rule that applies to the ui and web suites does not bite here.
      // If a later change needs room, add branch tests; do not lower the floor.
      //
      // When you raise a floor, record what you measured, under which
      // command, and the margin you left — that is what makes the ratchet
      // auditable. V1's own threshold values are deliberately NOT copied here;
      // they measure v1's code.
      thresholds: {
        lines: 96.5,
        functions: 99,
        branches: 87,
        statements: 96.5,
      },
    },
  },
})
