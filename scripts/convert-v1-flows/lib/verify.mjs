/**
 * Output verification (task 5.1).
 *
 * The general pack validator does not exist (§42 declares `packs:validate`;
 * nothing backs it yet), so conversion verifies its own output before claiming
 * success.
 *
 * It re-reads every file FROM DISK rather than reusing the in-memory objects
 * that produced them. Trusting those objects would verify the plan rather than
 * the artifact, and would miss a serialization bug, a path collision or a write
 * that never landed — exactly the failures worth catching.
 */

import { existsSync, readFileSync } from "node:fs"
import { join, posix, sep } from "node:path"

import { BUNDLE_FILES } from "./source.mjs"
import { isSemanticallyEqual } from "./normalize.mjs"
import {
  ANSWER_KEY_FIELDS,
  ALLOWED_MODE_KEYS,
  LEGACY_MODE_KEY,
  assertAnswerKeysConfined,
  assertNoFieldLevelVisibleWhen,
} from "./assertions.mjs"

export class VerificationError extends Error {}

const VARIANT_PATH = /^flows\/([^/]+)\/(v[2-5])\/([^/]+)$/
const BASE_PATH = /^flows\/([^/]+)\/([^/]+)$/

/**
 * Verify the written pack.
 *
 * `expectedPaths` is what conversion believes it wrote, relative to the pack
 * root with forward slashes.
 */
export function verifyOutput({
  outputRoot,
  expectedPaths,
  reasonCodeVocabulary,
}) {
  const problems = []
  const parsed = new Map()

  // 1. Everything conversion claims to have written exists and parses.
  for (const relativePath of expectedPaths) {
    const full = join(outputRoot, relativePath.split(posix.sep).join(sep))
    if (!existsSync(full)) {
      problems.push(`${relativePath}: expected output is missing from disk`)
      continue
    }
    if (!relativePath.endsWith(".json")) continue
    try {
      parsed.set(relativePath, JSON.parse(readFileSync(full, "utf8")))
    } catch (error) {
      problems.push(
        `${relativePath}: does not parse as JSON — ${error.message}`
      )
    }
  }

  // 2. Structural rules from `flow-bundle-variant-rules`, re-checked on disk.
  const baseByFlow = new Map()
  for (const [relativePath, json] of parsed) {
    const base = BASE_PATH.exec(relativePath)
    if (base && BUNDLE_FILES.includes(base[2])) {
      if (!baseByFlow.has(base[1])) baseByFlow.set(base[1], new Map())
      baseByFlow.get(base[1]).set(base[2], json)
    }
  }

  for (const [flowCode, files] of baseByFlow) {
    for (const required of BUNDLE_FILES) {
      if (!files.has(required)) {
        problems.push(
          `flows/${flowCode}/: missing ${required} — a flow must carry all five bundle files (§13)`
        )
      }
    }
  }

  // Every flow carries its metadata and subject index, or subject routing is
  // lost for the refs §46 requires preserved.
  const seenRefs = new Map()
  for (const flowCode of baseByFlow.keys()) {
    const manifestPath = `flows/${flowCode}/flow.json`
    const manifest = parsed.get(manifestPath)
    if (!manifest) {
      problems.push(
        `${manifestPath}: missing — a flow must carry its name and subject index (§46)`
      )
      continue
    }
    if (typeof manifest.name !== "string" || manifest.name === "") {
      problems.push(`${manifestPath}: has no flow name`)
    }
    const variants = Array.isArray(manifest.variants) ? manifest.variants : []
    if (variants.length === 0) {
      problems.push(`${manifestPath}: declares no variants`)
    }
    for (const variant of variants) {
      const refs = Array.isArray(variant?.subjectRefs)
        ? variant.subjectRefs
        : []
      if (refs.length === 0) {
        problems.push(
          `${manifestPath}: variant "${variant?.variant}" declares no subject refs`
        )
      }
      // Collisions are counted, not failed: a ref claimed twice is a
      // pre-existing v1 authoring slip that the report raises for a decision.
      for (const ref of refs) {
        const owner = `${flowCode}/${variant?.variant}`
        if (!seenRefs.has(ref)) seenRefs.set(ref, owner)
      }
    }
  }

  const variantFilesByFlow = new Map()

  for (const [relativePath, json] of parsed) {
    const variant = VARIANT_PATH.exec(relativePath)
    if (!variant) continue
    const [, flowCode, variantName, fileName] = variant

    if (!BUNDLE_FILES.includes(fileName)) {
      problems.push(`${relativePath}: not a bundle file`)
      continue
    }

    const key = `${flowCode}/${variantName}`
    if (!variantFilesByFlow.has(key)) variantFilesByFlow.set(key, new Set())
    variantFilesByFlow.get(key).add(fileName)

    // No variant file may duplicate its base — the defect §13 removes.
    const baseJson = baseByFlow.get(flowCode)?.get(fileName)
    if (baseJson !== undefined && isSemanticallyEqual(json, baseJson)) {
      problems.push(
        `${relativePath}: identical to its base after normalization — a duplicate variant file ` +
          `must be dropped, not written (§13)`
      )
    }
  }

  // A variant folder exists to carry what varies, so it must carry data.json.
  for (const [key, files] of variantFilesByFlow) {
    if (!files.has("data.json")) {
      problems.push(
        `flows/${key}/: has no data.json — a variant folder with nothing varying has no purpose`
      )
    }
  }

  // 3. Per-file content rules.
  for (const [relativePath, json] of parsed) {
    const fileName = relativePath.split(posix.sep).pop()

    if (fileName === "ui.json") {
      try {
        assertNoFieldLevelVisibleWhen(json, relativePath)
      } catch (error) {
        problems.push(error.message)
      }
      for (const entry of json?.denyConfig?.rejectCodes ?? []) {
        const code = typeof entry === "string" ? entry : entry?.code
        if (typeof code !== "string") continue
        if (reasonCodeVocabulary && !reasonCodeVocabulary.has(code)) {
          problems.push(
            `${relativePath}: authors reject code "${code}", absent from the pack vocabulary (§5)`
          )
        }
      }
    }

    if (fileName === "data.json") {
      try {
        assertAnswerKeysConfined(json, relativePath)
      } catch (error) {
        problems.push(error.message)
      }
    }

    if (fileName === "state.json") {
      const modeKeys = Object.keys(json?.modeConfig ?? {})
      if (modeKeys.includes(LEGACY_MODE_KEY)) {
        problems.push(
          `${relativePath}: carries the legacy "${LEGACY_MODE_KEY}" mode key (§16)`
        )
      }
      for (const key of modeKeys) {
        if (!ALLOWED_MODE_KEYS.includes(key)) {
          problems.push(`${relativePath}: unknown mode key "${key}" (§16)`)
        }
      }
    }

    if (fileName === "result.json") {
      const rubric = json?.rubric
      if (rubric && "passMark" in rubric) {
        problems.push(
          `${relativePath}: still carries rubric.passMark — the flow pass mark belongs to the ` +
            `pass_standards surface (§45.2)`
        )
      }
      for (const field of ["expectedDecision", "expectedReasonCode"]) {
        if (rubric && rubric[field] === "") {
          problems.push(
            `${relativePath}: rubric.${field} is "" — a no-decision answer is null, not an ` +
              `empty string (§5)`
          )
        }
      }
      const reasonCode = rubric?.expectedReasonCode
      if (
        typeof reasonCode === "string" &&
        reasonCode !== "" &&
        reasonCodeVocabulary &&
        !reasonCodeVocabulary.has(reasonCode)
      ) {
        problems.push(
          `${relativePath}: rubric expects reason code "${reasonCode}", absent from the pack ` +
            `vocabulary (§5)`
        )
      }
    }
  }

  // 4. Nothing on disk that conversion did not mean to write.
  if (problems.length) {
    throw new VerificationError(
      `The written pack does not satisfy its own rules (${problems.length} problem(s)):\n` +
        problems.map((problem) => `  - ${problem}`).join("\n")
    )
  }

  return {
    filesVerified: parsed.size,
    flowsVerified: baseByFlow.size,
    variantFoldersVerified: variantFilesByFlow.size,
  }
}

/** Answer-key field names, re-exported so the report can name what it checked. */
export { ANSWER_KEY_FIELDS }
