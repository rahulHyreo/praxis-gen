import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  // `*.timestamp-*.mjs` is the temporary bundle Vite writes next to
  // vitest.config.ts while loading it, then deletes. CI runs lint and test in
  // parallel in one workspace, so ESLint can list that file and find it gone
  // when it opens it (ENOENT, lint exits 2).
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
    },
  },
  {
    files: [
      "src/components/**/*.tsx",
      "**/test/**",
      "**/*.{test,spec}.{ts,tsx}",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },
])
