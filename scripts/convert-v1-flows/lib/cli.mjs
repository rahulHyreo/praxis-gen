/**
 * Argument parsing and pre-flight checks (task 1.1).
 *
 * Kept apart from index.mjs so the parsing and the "fail before touching the
 * output" guarantee are testable without spawning a process or stubbing
 * `process.exit`.
 */

import { existsSync, statSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"

import { SourceError } from "./source.mjs"

/** Default output root, relative to the repo this script lives in. */
export const DEFAULT_OUTPUT_ROOT = "packs/claims"

/**
 * Where v1 holds its bespoke sub-tab map (design D7). Relative to the v1 repo
 * root, which is derived from the flows path unless `--v1-root` is given.
 */
export const BESPOKE_MAP_RELATIVE_PATH = join(
  "apps",
  "web",
  "src",
  "features",
  "training",
  "view",
  "workspace",
  "customSubTabRenderers.tsx"
)

/** `<v1>/apps/api/src/data/flows` → `<v1>`. Five segments up. */
export function deriveV1Root(flowsPath) {
  return resolve(flowsPath, "..", "..", "..", "..", "..")
}

export function parseArgs(argv, { cwd = process.cwd() } = {}) {
  const positional = []
  const flags = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--v1-root") {
      flags.v1Root = argv[i + 1]
      i += 1
    } else if (arg.startsWith("--v1-root=")) {
      flags.v1Root = arg.slice("--v1-root=".length)
    } else if (arg === "--out") {
      flags.out = argv[i + 1]
      i += 1
    } else if (arg.startsWith("--out=")) {
      flags.out = arg.slice("--out=".length)
    } else if (arg.startsWith("--")) {
      throw new SourceError(`Unknown option: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  const [sourceArg, outArg] = positional

  if (!sourceArg) {
    throw new SourceError(
      "Usage: pnpm packs:convert-v1 <v1-flows-path> [output-root]\n" +
        "  <v1-flows-path>  e.g. D:/.../praxis/apps/api/src/data/flows\n" +
        `  [output-root]    defaults to ${DEFAULT_OUTPUT_ROOT}`
    )
  }

  const sourceRoot = isAbsolute(sourceArg)
    ? resolve(sourceArg)
    : resolve(cwd, sourceArg)

  const outRelative = flags.out ?? outArg ?? DEFAULT_OUTPUT_ROOT
  const outputRoot = isAbsolute(outRelative)
    ? resolve(outRelative)
    : resolve(cwd, outRelative)

  const v1Root = flags.v1Root
    ? resolve(cwd, flags.v1Root)
    : deriveV1Root(sourceRoot)

  return { sourceRoot, outputRoot, v1Root }
}

/**
 * Check the source before the output is touched.
 *
 * Order is the point: a run that fails halfway through writing leaves a pack
 * that is neither the old content nor the new. Everything checkable about the
 * source is checked first, and the message carries the resolved path because
 * the usual cause is a relative path resolved against an unexpected cwd.
 */
export function assertSourceReadable({ sourceRoot, v1Root }) {
  if (!existsSync(sourceRoot)) {
    throw new SourceError(
      `The v1 flows directory does not exist:\n  ${sourceRoot}\n` +
        `Check the path — it should end in apps/api/src/data/flows.`
    )
  }

  let stat
  try {
    stat = statSync(sourceRoot)
  } catch (cause) {
    throw new SourceError(
      `Cannot stat the v1 flows directory:\n  ${sourceRoot}`,
      {
        cause,
      }
    )
  }

  if (!stat.isDirectory()) {
    throw new SourceError(
      `The v1 flows path is not a directory:\n  ${sourceRoot}`
    )
  }

  const bespokeMapPath = join(v1Root, BESPOKE_MAP_RELATIVE_PATH)
  if (!existsSync(bespokeMapPath)) {
    throw new SourceError(
      `Cannot find v1's bespoke sub-tab map:\n  ${bespokeMapPath}\n` +
        `It is needed to lift sub-tab → component bindings into pack data (§14.2).\n` +
        `Pass --v1-root <path-to-v1-repo> if the flows path is not inside the v1 repo.`
    )
  }

  return { bespokeMapPath }
}
