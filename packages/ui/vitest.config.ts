import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Run test files serially in one fork. The jsdom + Radix + user-event
    // combination is flaky under parallel workers (timer/resource contention);
    // each file still gets an isolated environment, so this only removes
    // cross-file parallelism, not isolation.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/styles/**",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
      // COVERAGE RATCHET — raise these, never lower them.
      //
      // Measured TWICE under `pnpm test` — the command the git hooks and CI run —
      // with Turbo's cache cleared between runs. Both readings were identical.
      // Reading: 95.91 / 92.75 / 95.65 / 95.91.
      //
      // A jsdom + Radix suite, which v1 records swinging ~0.2pp between
      // identical runs, so each floor keeps ~0.5pp rather than sitting on the
      // reading. V1 learned this the expensive way: a floor set just under the
      // higher of two readings failed the next run by 0.01%.
      //
      // When you raise a floor, record what you measured, under which
      // command, and the margin you left — that is what makes the ratchet
      // auditable. V1's own threshold values are deliberately NOT copied here;
      // they measure v1's code.
      thresholds: {
        lines: 95.4,
        functions: 95.1,
        branches: 92.2,
        statements: 95.4,
      },
    },
  },
})
