import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Run test files serially in one fork — jsdom + React + async viewmodels
    // are flaky under parallel workers. Each file keeps an isolated
    // environment, so this removes cross-file parallelism, not isolation.
    // One fork also loads jsdom and React once rather than once per file.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // The same ceiling the api suite uses. A loaded machine runs these several
    // times slower than a developer laptop, and a component test that renders
    // a large tree can pass every assertion and still trip a 5s default.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test/**",
        // main.tsx mounts into a real DOM document; its behaviour is the
        // browser's, not a unit's.
        "src/main.tsx",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
      // COVERAGE RATCHET — raise these, never lower them.
      //
      // Measured TWICE under `pnpm test` — the command the git hooks and CI run —
      // with Turbo's cache cleared between runs. Both readings were identical.
      // Reading: 99.51 / 96.29 / 100 / 99.51.
      //
      // Same jsdom swing caveat as packages/ui, so branches keep ~0.6pp. The
      // reading reached here only after lib/api.ts and the root composition got
      // real tests — functions read 43.75 before that.
      //
      // When you raise a floor, record what you measured, under which
      // command, and the margin you left — that is what makes the ratchet
      // auditable. V1's own threshold values are deliberately NOT copied here;
      // they measure v1's code.
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 95.7,
        statements: 99,
      },
    },
  },
  resolve: {
    alias: {
      // Keep in sync with vite.config.ts. Without these, every test importing
      // `@/…` fails to resolve — vitest bundles its own Vite and does not read
      // the app's tsconfig paths.
      //
      // Unlike vite.config.ts, `@workspace/ui` IS aliased here: no test
      // imports a stylesheet, so the package's `exports` map (which sends
      // ./globals.css to src/styles/globals.css) is not needed, and the plain
      // directory mapping resolves the component modules fine.
      "@": path.resolve(import.meta.dirname, "./src"),
      "@workspace/ui": path.resolve(
        import.meta.dirname,
        "../../packages/ui/src"
      ),
    },
  },
})
