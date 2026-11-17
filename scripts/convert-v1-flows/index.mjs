#!/usr/bin/env node
/**
 * Convert v1's flow bundles into the claims pack (design D1).
 *
 *   pnpm packs:convert-v1 <v1-flows-path> [output-root]
 *
 * A build-time script, not the §46 runtime import service: the source is files
 * in a sibling repository and the destination is `packs/`, which §5 defines as
 * authored content committed to this repo. So it adds no runtime dependency to
 * `apps/api`, needs no database, and its output is reviewed as a diff.
 *
 * The v1 tree is opened read-only and is never written to.
 *
 * Thin on purpose: argument handling lives in lib/cli.mjs and the pipeline in
 * lib/convert.mjs, so both are testable without spawning a process or stubbing
 * `process.exit`.
 */

import { join } from "node:path"

import { assertSourceReadable, parseArgs } from "./lib/cli.mjs"
import { convert } from "./lib/convert.mjs"
import { PACK_FILES } from "./lib/manifest.mjs"

/** Where v1 keeps the reject-code catalog §5 makes pack data (design D10). */
const CATALOG_RELATIVE_PATH = join(
  "packages",
  "shared",
  "src",
  "schemas",
  "reject-codes.ts"
)

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`

async function main(argv) {
  const { sourceRoot, outputRoot, v1Root } = parseArgs(argv)
  const { bespokeMapPath } = assertSourceReadable({ sourceRoot, v1Root })

  const result = await convert({
    sourceRoot,
    outputRoot,
    bespokeMapPath,
    catalogPath: join(v1Root, CATALOG_RELATIVE_PATH),
  })

  const dropped = result.sizes.source - result.sizes.written
  const percent = Math.round((dropped / result.sizes.source) * 100)

  console.log(`Converted ${result.flows} flows (${result.bundles} bundles).`)
  console.log(
    `  files:      ${result.filesPlanned} in the pack, ${result.filesWritten} changed this run`
  )
  console.log(`  dropped:    ${result.drops} source files`)
  if (result.orphansRemoved > 0) {
    console.log(`  pruned:     ${result.orphansRemoved} orphaned output files`)
  }
  console.log(
    `  size:       ${mb(result.sizes.written)} written from ${mb(result.sizes.source)} source (${percent}% dropped)`
  )
  console.log(
    `  vocabulary: ${result.decisionOptions.join(", ")} + ${result.reasonCodeVocabularySize} reason codes`
  )
  console.log(
    `  subjects:   ${result.subjectRefs} refs indexed for subject routing`
  )
  console.log(
    `  verified:   ${result.verification.filesVerified} files re-read from disk`
  )

  // Surfaced here, not buried in the report: a pre-existing content defect that
  // needs an authoring decision should be visible without opening a file.
  if (result.subjectRefCollisions.length > 0) {
    console.log(
      `\n${result.subjectRefCollisions.length} pre-existing defect(s) need an authoring decision:`
    )
    for (const collision of result.subjectRefCollisions) {
      console.log(
        `  ${collision.ref} is claimed by both ${collision.first} and ${collision.second}` +
          ` — subject routing is ambiguous`
      )
    }
  }

  console.log(`\nReport: ${join(outputRoot, PACK_FILES.report)}`)

  return 0
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  // The message is the product here: every failure names the file, flow or rule
  // involved, because that is what makes a failed conversion diagnosable.
  console.error(`\n${error.message}\n`)
  process.exitCode = 1
}
