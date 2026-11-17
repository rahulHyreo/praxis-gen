import { availableParallelism } from "node:os"
import { defineConfig } from "vitest/config"

// How many test files run at once. ONE when a real test database is attached:
// setup.ts truncates every domain table in a beforeEach, so two DB-backed
// files must never overlap. Without TEST_DATABASE_URL those suites skip, every
// remaining file is independent, and they run side by side: one per CPU, less
// one for the rest of the build, at most four. VITEST_MAX_FORKS overrides the
// default. Each fork is capped at the heap below, so the worst case is
// maxForks x 2 GB.
const maxForks = process.env.TEST_DATABASE_URL
  ? 1
  : Number(process.env.VITEST_MAX_FORKS) ||
    Math.max(1, Math.min(4, availableParallelism() - 1))

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 30000,
    // Prints "N MB heap used" per test file. With a fresh fork per file (see
    // the pool below) that number IS the file's working set, so a CI log
    // becomes a per-file memory profile instead of a bare "Killed".
    logHeapUsage: true,
    // forks, NOT threads — and this is load-bearing, not a preference. A
    // worker thread rejects --max-old-space-size in execArgv
    // (ERR_WORKER_INVALID_EXEC_ARGV) and its heap sits inside the main
    // process's resident set, so with threads neither the ceiling below nor a
    // legible out-of-memory failure is achievable.
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks,
        // LOAD-BEARING, not tidying. This is the flag Vitest turns into
        // tinypool's isolateWorkers. Setting it false reuses the fork across
        // files and rebuilds exactly the heap this block exists to bound: V1
        // measured a monotonic ~340 MB-per-file climb and a kernel OOM kill
        // 32 minutes into a run before this configuration.
        isolate: true,
        // A ceiling, not an allocation. Crossing it throws V8's "JavaScript
        // heap out of memory" with a stack naming the file (exit 134) instead
        // of the process being SIGKILLed by the kernel with no attribution.
        // A command-line flag beats NODE_OPTIONS, which the child inherits.
        execArgv: ["--max-old-space-size=2048"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/__mocks__/**",
        "src/test/**",
        "**/dist/**",
        "**/*.config.ts",
        "**/*.d.ts",
        // index.ts binds a port and installs signal handlers; its behaviour is
        // exercised by bringing the stack up, not by a unit test.
        "src/index.ts",
      ],
      // COVERAGE RATCHET — raise these, never lower them.
      //
      // Measured TWICE under `pnpm test` — the command the git hooks and CI run —
      // with Turbo's cache cleared between runs. Both readings were identical.
      // Reading: 100 / 88.88 / 100 / 100.
      //
      // Statements, functions and lines sit at 99 rather than 100: this package
      // will grow faster than any other, and a service's defensive error branch
      // is sometimes genuinely hard to reach. One point of slack, not a licence
      // to skip tests.
      //
      // When you raise a floor, record what you measured, under which
      // command, and the margin you left — that is what makes the ratchet
      // auditable. V1's own threshold values are deliberately NOT copied here;
      // they measure v1's code.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 88,
        statements: 99,
      },
    },
  },
})
