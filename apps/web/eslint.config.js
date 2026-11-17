import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  // `*.timestamp-*.mjs` is the temporary bundle Vite writes next to
  // vite.config.ts / vitest.config.ts while loading it, then deletes. Lint and
  // test can run in parallel in one workspace, so ESLint can list that file
  // and find it gone when it opens it (ENOENT, lint exits 2).
  globalIgnores(["dist", "coverage", "**/*.timestamp-*.mjs"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // An instant is never formatted in the VIEWER's time zone.
      //
      // Praxis v1 bans this in favour of fixed-IST formatters. docs/SPEC.md §7
      // [changed] replaces that: the display time zone is per cohort, derived
      // from its market and overridable on the cohort, so a trainee in the US
      // market and one in the IN market see the same instant differently and
      // NEITHER sees it in their browser's zone. That makes the rule more
      // important than in v1, not less — browser-local formatting silently
      // produces a third answer belonging to no cohort.
      //
      // The zone-aware formatter this points at lands in
      // packages/shared/src/format/ with the markets and cohorts change (§7,
      // §9). Until then nothing in this app formats an instant, so the rule has
      // nothing to catch and is here to catch the first one.
      //
      // A calendar-only date (a date of birth, a picked day) is not an instant
      // and has no zone; a justified eslint-disable is the escape hatch.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message:
            "Do not format an instant in the viewer's time zone. The display zone is per cohort/market (SPEC §7) — use the zone-aware formatter in @platform/shared. For numbers use Intl.NumberFormat.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns",
              importNames: ["format"],
              message:
                "date-fns `format` uses the viewer's time zone. The display zone is per cohort/market (SPEC §7) — use the zone-aware formatter in @platform/shared. Calendar-date handling needs a justified eslint-disable.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/test/**", "**/*.{test,spec}.{ts,tsx}", "**/__tests__/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
])
