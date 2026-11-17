/**
 * What v1 actually serves (design D2, tasks 2.1 and 2.3).
 *
 * The variant directories are not self-describing. A `v3/ui.json` on disk may
 * or may not reach a trainee: v1 builds each variant's bundle in `index.ts` by
 * binding five properties, and a property may bind the base import or the
 * variant's own. Nothing in the JSON records which.
 *
 * That makes `index.ts` the only record of what is live, and it has to be read
 * for ALL FIVE files rather than the navigator alone. The navigator is the case
 * §13 describes, but it is not the only one:
 *
 *   - `X4.1` v2–v5 carry a `ui.json` that differs from base and a
 *     `navigator.json` that differs from base, and v1 binds NEITHER. Both are
 *     dead content. Carrying them would change what a trainee sees.
 *   - `W-DMX.2` v2–v5 carry a `state.json` that differs and IS bound, so it is
 *     live and must be carried.
 *
 * So "distinct" and "live" are independent questions, and a file is carried
 * only when it is both.
 *
 * The analysis is deliberately narrow and fails loudly. Guessing here would
 * silently change what a trainee is graded against, so an unresolvable binding
 * aborts the run naming the flow (D2).
 */

import { BUNDLE_FILES, VARIANT_DIRS } from "./source.mjs"

export class ReachabilityError extends Error {}

/** Property name in the bundle literal for each bundle file. */
const PROPERTY_FOR_FILE = {
  "ui.json": "ui",
  "data.json": "data",
  "navigator.json": "navigator",
  "state.json": "state",
  "result.json": "result",
}

/**
 * `import <local> from "./[vN/]<file>.json" with { type: "json" }`
 *
 * Captures the local binding name and the path it points at, which is what
 * turns `navigator: navigator2` into "this variant's own navigator".
 */
const IMPORT_PATTERN =
  /import\s+(\w+)\s+from\s+"\.\/((?:v[2-5]\/)?(?:ui|data|navigator|state|result)\.json)"/g

/**
 * The counts this converter was written against, asserted by
 * `assertKnownReachability`. A change here means v1's authoring changed and
 * the report's expectations need review before the output can be trusted.
 */
export const EXPECTED_LIVE_VARIANT_FILES = {
  "ui.json": [],
  "data.json": null, // every variant binds its own data — that is why variants exist
  "navigator.json": ["507.3", "W-DMX.2"],
  "state.json": ["W-DMX.2"],
  "result.json": [],
}

/**
 * Resolve, for one flow, which of each variant's files v1 binds.
 *
 * Returns `{ [variant]: { [file]: boolean } }` — true when v1 serves the
 * variant's own copy of that file.
 */
export function analyzeFlowReachability({ code, indexSource, variants }) {
  if (!indexSource) {
    throw new ReachabilityError(
      `Flow ${code} has no index.ts, so there is no record of which variant files v1 serves. ` +
        `Refusing to guess (design D2).`
    )
  }

  const imports = {}
  for (const match of indexSource.matchAll(IMPORT_PATTERN)) {
    imports[match[1]] = match[2]
  }

  const result = {}

  for (const variant of variants) {
    const anchor = indexSource.indexOf(`flowSlug: "${code}/${variant.name}"`)
    if (anchor === -1) {
      throw new ReachabilityError(
        `Flow ${code} has a ${variant.name}/ directory on disk, but index.ts declares no ` +
          `bundle with flowSlug "${code}/${variant.name}". Cannot tell what v1 serves for it ` +
          `(design D2).`
      )
    }

    // The bundle literals are written one after another and closed with
    // `} as const`, so the next close is the end of this one.
    const close = indexSource.indexOf("} as const", anchor)
    const literal = indexSource.slice(
      anchor,
      close === -1 ? indexSource.length : close
    )

    const perFile = {}

    for (const file of BUNDLE_FILES) {
      const property = PROPERTY_FOR_FILE[file]

      // `navigator: navigator2,` — an explicit binding.
      const explicit = literal.match(
        new RegExp("^\\s+" + property + ":\\s*([\\w.]+),", "m")
      )
      // `navigator,` — shorthand, so the binding is the base import.
      const shorthand = new RegExp("^\\s+" + property + ",", "m").test(literal)

      let boundPath
      if (explicit) boundPath = imports[explicit[1]]
      else if (shorthand) boundPath = imports[property]

      if (!boundPath) {
        throw new ReachabilityError(
          `Flow ${code} ${variant.name}: cannot resolve which ${file} v1 serves. ` +
            `index.ts binds "${property}" to ${explicit ? `"${explicit[1]}"` : shorthand ? "shorthand" : "nothing"}, ` +
            `which does not resolve to an imported bundle file. Refusing to guess (design D2).`
        )
      }

      perFile[file] = boundPath.startsWith(`${variant.name}/`)
    }

    result[variant.name] = perFile
  }

  return result
}

/**
 * Assert the reachability result matches the v1 content this converter was
 * written against (task 2.3).
 *
 * Failing this does not mean the converter is wrong — it means v1 changed. The
 * message says so, because the right response is to review the analysis and the
 * report's expectations, not to edit the expected list until it passes.
 */
export function summarizeReachability(reachabilityByFlow) {
  const liveFlowsByFile = {}

  for (const file of BUNDLE_FILES) liveFlowsByFile[file] = new Set()

  for (const [code, byVariant] of Object.entries(reachabilityByFlow)) {
    for (const perFile of Object.values(byVariant)) {
      for (const [file, isLive] of Object.entries(perFile)) {
        if (isLive) liveFlowsByFile[file].add(code)
      }
    }
  }

  return {
    liveFlowsByFile: Object.fromEntries(
      Object.entries(liveFlowsByFile).map(([file, set]) => [
        file,
        [...set].sort(),
      ])
    ),
  }
}

export function assertKnownReachability(
  reachabilityByFlow,
  expectedLiveVariantFiles = EXPECTED_LIVE_VARIANT_FILES
) {
  const { liveFlowsByFile } = summarizeReachability(reachabilityByFlow)
  const problems = []

  for (const [file, expected] of Object.entries(expectedLiveVariantFiles)) {
    if (expected === null) continue // not pinned: every flow binds its own data
    const actual = liveFlowsByFile[file] ?? []
    const want = [...expected].sort()
    if (actual.join(",") !== want.join(",")) {
      problems.push(
        `  ${file}: expected per-variant bindings only in [${want.join(", ") || "none"}], ` +
          `found [${actual.join(", ") || "none"}]`
      )
    }
  }

  if (problems.length) {
    throw new ReachabilityError(
      `v1's per-variant bindings are not what this converter was written against:\n` +
        problems.join("\n") +
        `\nv1's authoring changed. Review design D2/D3 and the report expectations before re-running.`
    )
  }

  return { liveFlowsByFile }
}

/** Variant directory names, re-exported so rules need one import. */
export { VARIANT_DIRS }
