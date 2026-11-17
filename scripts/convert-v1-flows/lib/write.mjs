/**
 * Deterministic output (task 5.3).
 *
 * Two runs over an unchanged source must produce byte-identical output, or
 * "re-run and diff" stops being a usable review. So: no timestamp, absolute
 * path, hostname or run id in any pack file, a fixed two-space indent, and a
 * trailing newline so the files are POSIX text and Prettier-stable.
 *
 * Key order is PRESERVED from the source rather than sorted. Normalization is
 * for comparison only (D4); writing sorted keys would make every converted file
 * diff against its v1 original for no reason.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, posix, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Serialize one pack file, formatted exactly as the repo's Prettier would.
 *
 * It has to be Prettier's own output, not `JSON.stringify(value, null, 2)`.
 * `.prettierignore` deliberately does NOT ignore `packs/` — Prettier is the
 * only formatter that covers authored pack content — so output that merely
 * looks tidy fails `pnpm format:check`. The two disagree in practice:
 * `JSON.stringify` always expands an array, while Prettier keeps a short one
 * on a single line (`["LINDA", "R", "CARTER"]`), which differed in 471 of the
 * 930 pack files.
 *
 * The config is RESOLVED from the repo rather than passed as literals, so the
 * pack follows `.prettierrc` and cannot drift from it.
 */
export async function serializeJson(value, { prettierConfig } = {}) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (!prettierConfig) return text

  const { format } = await import("prettier")
  return format(text, { ...prettierConfig, parser: "json" })
}

/**
 * Resolve the repo's Prettier config once, for reuse across every file.
 *
 * Resolved from THIS MODULE's path, not the output path. Prettier looks for
 * config by walking up from the file it is given, so resolving from the output
 * would silently skip formatting whenever the pack is written outside the repo
 * — a test fixture, or a `--out` elsewhere — and produce output that fails
 * `format:check` once committed. The script always lives in the repo.
 */
export async function resolvePrettierConfig(
  filepath = fileURLToPath(import.meta.url)
) {
  const prettier = await import("prettier")
  const resolved = await prettier.resolveConfig(filepath)
  if (!resolved) return null
  // The Tailwind plugin has nothing to say about JSON and loading it per file
  // is pure overhead.
  const { plugins: _plugins, ...rest } = resolved
  return rest
}

/** Format already-rendered markdown the same way. */
export async function serializeMarkdown(text, { prettierConfig } = {}) {
  if (!prettierConfig) return text
  const { format } = await import("prettier")
  return format(text, { ...prettierConfig, parser: "markdown" })
}

/**
 * Write a file only when its bytes would change.
 *
 * Keeps mtimes stable across re-runs, so an idempotent run leaves the working
 * tree untouched rather than merely unchanged in content.
 */
export function writeFileIfChanged(path, contents) {
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8")
    if (current === contents) return { written: false }
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, "utf8")
  return { written: true }
}

/** Write one JSON pack file deterministically. */
export async function writeJsonFile(path, value, options) {
  return writeFileIfChanged(path, await serializeJson(value, options))
}

/** Every file under `root`, as paths relative to it with forward slashes. */
export function listExistingFiles(root) {
  if (!existsSync(root)) return []

  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) found.push(toPosix(relative(root, full)))
    }
  }
  walk(root)
  return found.sort()
}

/** Normalize a path for comparison and for writing into the report. */
export function toPosix(path) {
  return path.split(sep).join(posix.sep)
}

/**
 * Remove a file and any directories it leaves empty.
 *
 * Without the directory sweep a pruned flow would leave an empty `flows/<code>/`
 * behind, which reads as a flow that exists but has no content.
 */
export function removeFileAndEmptyParents(root, relativePath) {
  const full = join(root, relativePath.split(posix.sep).join(sep))
  if (existsSync(full)) rmSync(full)

  let dir = dirname(full)
  while (dir.startsWith(root) && dir !== root) {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    if (entries.length > 0) return
    rmSync(dir, { recursive: true })
    dir = dirname(dir)
  }
}

/** True when `path` is a directory that exists. */
export function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
