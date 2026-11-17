/**
 * Read-only reader for a v1 flows tree (design D1, task 1.3).
 *
 * The source is another repository's working copy. Nothing here opens a file
 * for writing, and the converter never mkdirs, moves or deletes inside it.
 *
 * Shape of a v1 flow directory:
 *
 *   <code>/
 *     ui.json data.json navigator.json state.json result.json
 *     index.ts                     <- the only record of what v1 actually serves
 *     v2/ v3/ v4/ v5/              <- same five filenames again
 *
 * `index.ts` matters because the variant directories are not self-describing:
 * a `v3/navigator.json` on disk may or may not reach a trainee. See
 * lib/reachability.mjs.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** The five files that make up a bundle (§13). */
export const BUNDLE_FILES = [
  "ui.json",
  "data.json",
  "navigator.json",
  "state.json",
  "result.json",
]

/** Variant directory names v1 uses. */
export const VARIANT_DIRS = ["v2", "v3", "v4", "v5"]

/**
 * Files a source flow directory may contain beyond BUNDLE_FILES. Anything else
 * fails the run rather than being copied blindly (task 4.5) — an unaccounted
 * file is either content we would silently drop or content we would silently
 * ship.
 */
export const KNOWN_EXTRA_FILES = ["index.ts"]

/** Counts asserted against the v1 source (design, `claims-pack-content`). */
export const EXPECTED_FLOW_COUNT = 92
export const EXPECTED_VARIANT_DIR_COUNT = 364

export class SourceError extends Error {}

const isDir = (path) => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * List flow directory names, skipping dotted ones.
 *
 * `.omc` is tooling state in the v1 tree, not a flow. Skipping by leading dot
 * rather than by name keeps the rule general.
 */
export function listFlowCodes(sourceRoot) {
  let entries
  try {
    entries = readdirSync(sourceRoot, { withFileTypes: true })
  } catch (cause) {
    throw new SourceError(
      `Cannot read the v1 flows directory: ${sourceRoot}\n` +
        `Pass the path as the first argument, e.g. pnpm packs:convert-v1 <v1>/apps/api/src/data/flows`,
      { cause }
    )
  }

  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort()
}

/** Parse one JSON file, naming the file when it does not parse. */
export function readJsonFile(path) {
  let raw
  try {
    raw = readFileSync(path, "utf8")
  } catch (cause) {
    throw new SourceError(`Cannot read ${path}`, { cause })
  }
  try {
    return { json: JSON.parse(raw), raw }
  } catch (cause) {
    throw new SourceError(`${path} is not valid JSON`, { cause })
  }
}

/**
 * Read one flow: its base bundle, its variant bundles and its `index.ts` text.
 *
 * Read per flow rather than all at once: the source is 111.7 MB and `ui.json`
 * alone is 89 MB of it, so holding every bundle in memory would cost far more
 * than processing one flow and releasing it.
 */
export function readFlow(sourceRoot, code) {
  const flowDir = join(sourceRoot, code)

  const present = readdirSync(flowDir, { withFileTypes: true })
  const fileNames = present.filter((e) => e.isFile()).map((e) => e.name)

  for (const name of BUNDLE_FILES) {
    if (!fileNames.includes(name)) {
      throw new SourceError(
        `Flow ${code} is missing ${name}. A flow must carry all five bundle files (§13): ${BUNDLE_FILES.join(", ")}`
      )
    }
  }

  const unknown = fileNames.filter(
    (n) => !BUNDLE_FILES.includes(n) && !KNOWN_EXTRA_FILES.includes(n)
  )

  const base = {}
  for (const name of BUNDLE_FILES) {
    base[name] = readJsonFile(join(flowDir, name))
  }

  const variants = []
  for (const variant of VARIANT_DIRS) {
    const variantDir = join(flowDir, variant)
    if (!isDir(variantDir)) continue

    const variantEntries = readdirSync(variantDir, { withFileTypes: true })
    const variantFileNames = variantEntries
      .filter((e) => e.isFile())
      .map((e) => e.name)

    const unknownInVariant = variantFileNames.filter(
      (n) => !BUNDLE_FILES.includes(n)
    )

    const files = {}
    for (const name of BUNDLE_FILES) {
      if (!variantFileNames.includes(name)) continue
      files[name] = readJsonFile(join(variantDir, name))
    }

    variants.push({ name: variant, files, unknownFiles: unknownInVariant })
  }

  const indexPath = join(flowDir, "index.ts")
  const indexSource = fileNames.includes("index.ts")
    ? readFileSync(indexPath, "utf8")
    : null

  return { code, base, variants, indexSource, unknownFiles: unknown }
}

/**
 * Assert the source is the tree this converter was written against.
 *
 * A count that has moved means v1 gained or lost content, and every downstream
 * expectation in the report — and the reachability assertion in particular —
 * needs review before the output can be trusted. Failing with both numbers
 * makes that a one-line diagnosis.
 */
export function assertSourceInventory({
  flowCount,
  variantDirCount,
  expected = {
    flowCount: EXPECTED_FLOW_COUNT,
    variantDirCount: EXPECTED_VARIANT_DIR_COUNT,
  },
}) {
  const problems = []
  if (flowCount !== expected.flowCount) {
    problems.push(
      `expected ${expected.flowCount} flow groups, found ${flowCount}`
    )
  }
  if (variantDirCount !== expected.variantDirCount) {
    problems.push(
      `expected ${expected.variantDirCount} variant directories, found ${variantDirCount}`
    )
  }
  if (problems.length) {
    throw new SourceError(
      `The v1 source does not match the inventory this converter was written against:\n` +
        problems.map((p) => `  - ${p}`).join("\n") +
        `\nv1 content changed. Review lib/reachability.mjs and the report expectations before re-running.`
    )
  }
}
