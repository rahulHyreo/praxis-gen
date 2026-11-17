#!/usr/bin/env node
// Pre-commit: run the tests the staged changes can affect (.husky/pre-commit).
//
// The git hooks are develop's CI (docs/SPEC.md §Workflow), so the tests run
// here and in .husky/pre-push rather than in a pipeline. This is the quick
// half: `vitest related` in every package whose tests can import a staged file,
// coverage off, plus the api's database suites on an in-memory PGlite
// (apps/api/vitest.db.config.ts). The push runs everything, with the coverage
// gate.
//
// Nothing to set up: PGlite comes with `pnpm install`.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

// LOAD-BEARING on Windows: vitest loads its setup files TWICE when the cwd's
// drive letter is lowercase (d:\ rather than D:\), which fails every suite.
const upperDrive = (p) =>
  p.replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`)

const root = upperDrive(
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim()
)

// Merging develop in stages hundreds of files someone else already tested; the
// push still runs the full suite on the result.
const merging =
  spawnSync("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], {
    cwd: root,
  }).status === 0
if (merging) {
  console.log("  merge commit: related tests skipped, the push runs them all")
  process.exit(0)
}

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
  { cwd: root, encoding: "utf8" }
)
  .split("\0")
  .filter((file) => /\.(?:[cm]?[jt]sx?|json)$/.test(file))
  .filter((file) => existsSync(path.join(root, file)))

// Whose tests can reach a file in each package, through SOURCE rather than
// dist: api and web read @platform/shared from src, and web reads
// @workspace/ui from src. The api reads @platform/db from dist, so a db change
// is covered by db's own suite here and reaches the api's suites on push.
const REACH = {
  "apps/api": ["apps/api"],
  "apps/web": ["apps/web"],
  "packages/db": ["packages/db"],
  "packages/shared": ["packages/shared", "apps/api", "apps/web"],
  "packages/ui": ["packages/ui", "apps/web"],
}

const targets = new Set()
// A staged file that belongs to no package but IS covered by a test: the
// repo-level tooling (lint-staged.config.mjs, this file). Turbo only runs
// per-package suites, so without this the files that decide what gets linted
// and tested would be the only ones committed untested.
let rootTooling = false

for (const file of staged) {
  const pkg = Object.keys(REACH).find((p) => file.startsWith(`${p}/`))
  if (pkg) {
    for (const reached of REACH[pkg]) targets.add(reached)
  } else if (
    /^lint-staged\.config\.mjs$/.test(file) ||
    /^scripts\//.test(file) ||
    /^vitest\.workspace\.ts$/.test(file)
  ) {
    rootTooling = true
  }
}

if (targets.size === 0 && !rootTooling) {
  console.log("  no staged source files: nothing to test")
  process.exit(0)
}

const files = staged.map((file) => path.join(root, file))

const runs = Object.keys(REACH)
  .filter((pkg) => targets.has(pkg))
  .map((pkg) => ({ pkg, label: pkg, config: undefined, related: true }))

if (targets.has("apps/api")) {
  runs.push({
    pkg: "apps/api",
    label: "apps/api database suites (PGlite)",
    config: "vitest.db.config.ts",
    related: true,
  })
}

if (rootTooling) {
  // Run the whole project rather than `related`: it is one small file, and
  // `related` cannot trace a config file to the suite that imports it.
  runs.push({
    pkg: ".",
    label: "repo-level tooling",
    project: "root-tooling",
    related: false,
  })
}

// The hook's GIT_DIR / GIT_INDEX_FILE point at a linked worktree's private git
// dir; nothing below needs them, and tools that shell out to git misread them
// (see the typecheck step in .husky/pre-commit).
const env = { ...process.env }
delete env.GIT_DIR
delete env.GIT_INDEX_FILE

const failed = []
for (const run of runs) {
  const cwd = path.join(root, run.pkg)
  const vitest = [
    path.join(cwd, "node_modules", "vitest", "vitest.mjs"),
    path.join(root, "node_modules", "vitest", "vitest.mjs"),
  ].find((bin) => existsSync(bin))
  if (!vitest) {
    console.error(`  ${run.label}: vitest is not installed, run pnpm install`)
    process.exit(1)
  }

  const args = [
    vitest,
    ...(run.related ? ["related"] : []),
    "--run",
    "--passWithNoTests",
    "--coverage.enabled=false",
    ...(run.config ? ["--config", run.config] : []),
    ...(run.project ? ["--project", run.project] : []),
    ...(run.related ? files : []),
  ]

  console.log(`\n  ▸ ${run.label}`)
  const started = Date.now()
  const result = spawnSync(process.execPath, args, {
    cwd: upperDrive(cwd),
    env,
    stdio: "inherit",
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  if (result.status !== 0) {
    failed.push(run.label)
    console.error(`  ✗ ${run.label} (${seconds}s)`)
  } else {
    console.log(`  ✓ ${run.label} (${seconds}s)`)
  }
}

if (failed.length > 0) {
  console.error(
    `\nTests failed in ${failed.join(", ")}. Fix them before committing.\n` +
      `(--no-verify skips the hook, but never use it on a commit bound for ` +
      `develop: these hooks ARE develop's CI — see docs/SPEC.md §Workflow.)`
  )
  process.exit(1)
}
console.log(`\n  related tests passed: ${runs.map((r) => r.label).join(", ")}`)
