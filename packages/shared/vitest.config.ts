import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.{spec,test}.ts"],
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
        "src/**/__tests__/**",
        "src/test/**",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
      // COVERAGE RATCHET — raise these, never lower them.
      //
      // Measured TWICE under `pnpm test` — the command the git hooks and CI run —
      // with Turbo's cache cleared between runs. Both readings were identical.
      // Reading: 100 / 100 / 100 / 100 (statements / branches / functions / lines).
      //
      // Set ON the reading, with no slack, deliberately: this package is two
      // files of pure schemas and constants with no I/O and no timing, so the
      // measurement cannot swing. Full coverage is the right standing
      // expectation here. If a future branch is genuinely unreachable, add a
      // justified coverage exclude — do NOT lower this floor.
      //
      // When you raise a floor, record what you measured, under which
      // command, and the margin you left — that is what makes the ratchet
      // auditable. V1's own threshold values are deliberately NOT copied here;
      // they measure v1's code.
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
