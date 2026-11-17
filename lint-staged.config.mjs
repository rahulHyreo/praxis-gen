// Monorepo lint-staged config.
//
// prettier formats every staged file from the repo root. ESLint is the awkward
// part on two counts: (1) ESLint 9+/10 flat config only resolves a config from
// the current working directory, and the configs live PER PACKAGE (apps/*,
// packages/*), not at the root; (2) `eslint` is a per-package dev dependency and
// (under pnpm) is NOT hoisted to the root `node_modules/.bin`, so a bare
// `eslint` invoked from the repo root dies with "'eslint' is not recognized".
//
// We solve both by grouping staged files by their owning package and running
// `pnpm -C <pkg> exec eslint` once per package: `-C <pkg>` sets the cwd to the
// package (so the package-local eslint binary resolves and `--config
// eslint.config.js` is found), and the file arguments are passed relative to
// that package. The configs use `tsconfigRootDir: import.meta.dirname`, so the
// parser/plugins resolve relative to the config file regardless.
//
// Files outside a package get prettier only — there is no root eslint config to
// lint them with. That deliberately includes `packs/**`: authored pack content
// is JSON data, not code (docs/SPEC.md §5).
import path from "node:path"

const PKG_ROOTS = [
  "apps/api",
  "apps/web",
  "packages/db",
  "packages/shared",
  "packages/ui",
]

const root = process.cwd()
const rel = (file) => path.relative(root, file).split(path.sep).join("/")
const quote = (file) => `"${rel(file)}"`
const pkgOf = (file) => PKG_ROOTS.find((p) => rel(file).startsWith(`${p}/`))
// Path of a file relative to its owning package (for `pnpm -C <pkg> exec`).
const relToPkg = (pkg, file) =>
  path.relative(path.join(root, pkg), file).split(path.sep).join("/")
const quoteInPkg = (pkg, file) => `"${relToPkg(pkg, file)}"`

/**
 * Build the command list for a batch of staged code files.
 *
 * Exported so the tests can assert the grouping without shelling out to
 * lint-staged — the behaviour worth pinning is "one eslint invocation per
 * owning package, with package-relative paths", which is exactly what breaks
 * silently if someone simplifies this to a single root-level `eslint` call.
 */
export function codeCommands(files) {
  const cmds = [`prettier --write ${files.map(quote).join(" ")}`]

  const byPkg = new Map()
  for (const file of files) {
    const pkg = pkgOf(file)
    if (!pkg) continue
    const arr = byPkg.get(pkg) ?? []
    arr.push(file)
    byPkg.set(pkg, arr)
  }

  for (const [pkg, pkgFiles] of byPkg) {
    cmds.push(
      `pnpm -C ${pkg} exec eslint --fix --no-warn-ignored --config eslint.config.js ${pkgFiles
        .map((f) => quoteInPkg(pkg, f))
        .join(" ")}`
    )
  }

  return cmds
}

/** Build the command list for a batch of staged non-code files. */
export function dataCommands(files) {
  return `prettier --write ${files.map(quote).join(" ")}`
}

export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": codeCommands,
  "*.{json,md,yml,yaml,css,html}": dataCommands,
}
