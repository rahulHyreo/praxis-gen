/**
 * Pack-authored vocabularies (design D10, tasks 6.1 and 6.1a).
 *
 * §5: "Reason codes are likewise pack-authored vocabularies." v1 holds them in
 * two places, neither of them pack data, and the split is the defect:
 *
 *   - 15 codes with labels in `REJECT_CODE_CATALOG`
 *     (`packages/shared/src/schemas/reject-codes.ts`), the distractor pool the
 *     server pads a deny picker from.
 *   - 19 codes authored across bundles in `ui.json` `denyConfig.rejectCodes`.
 *   - 5 of the authored codes are missing from the catalog. v1's own comment
 *     concedes it: "Keep this in step when a flow introduces a new code; a code
 *     missing here is still offered, labelled by its code" — a vocabulary that
 *     degrades to showing a trainee a bare code.
 *
 * Conversion takes the union into `pack.json`, where one vocabulary cannot
 * drift from itself.
 *
 * The PX **edit bypass** codes are a separate vocabulary: short (`PX_CB`)
 * rather than long (`PX_RNBE00`), and used to bypass an edit rather than to
 * deny a claim.
 */

import { readFileSync } from "node:fs"

export class VocabularyError extends Error {}

/** `{ code: "PX_R01030", label: "..." }` entries in v1's catalog. */
const CATALOG_ENTRY_PATTERN =
  /\{\s*code:\s*"(PX_[A-Z0-9_]+)",\s*label:\s*(?:"((?:[^"\\]|\\.)*)"|\s*"((?:[^"\\]|\\.)*)")/g

/** The field id whose options are the PX edit bypass vocabulary. */
export const BYPASS_CODE_FIELD_ID = "f_er_bypass_code"

/**
 * Read v1's `REJECT_CODE_CATALOG`.
 *
 * Parsed rather than imported: the file is TypeScript in another repo, and a
 * build-time read should not need that repo's toolchain.
 */
export function readRejectCodeCatalog(catalogPath) {
  let source
  try {
    source = readFileSync(catalogPath, "utf8")
  } catch (cause) {
    throw new VocabularyError(
      `Cannot read v1's reject-code catalog: ${catalogPath}\n` +
        `It holds the distractor pool that §5 makes pack-authored (design D10).`,
      { cause }
    )
  }

  const entries = new Map()
  // Labels wrap across lines in the source, so normalize whitespace first.
  const flattened = source.replace(/\s+/g, " ")
  for (const match of flattened.matchAll(CATALOG_ENTRY_PATTERN)) {
    const code = match[1]
    const label = (match[2] ?? match[3] ?? "").replace(/\\"/g, '"')
    if (!entries.has(code)) entries.set(code, label)
  }

  if (entries.size === 0) {
    throw new VocabularyError(
      `Parsed no codes from ${catalogPath}. Its shape changed — review design D10.`
    )
  }

  return entries
}

/** Collect a flow's authored reject codes and labels from its `ui.json`. */
export function collectAuthoredReasonCodes(uiJson, into = new Map()) {
  for (const entry of uiJson?.denyConfig?.rejectCodes ?? []) {
    const code = typeof entry === "string" ? entry : entry?.code
    if (typeof code !== "string") continue
    const label = typeof entry?.label === "string" ? entry.label : ""
    if (!into.has(code) || (!into.get(code) && label)) into.set(code, label)
  }
  return into
}

/** Collect the PX edit bypass codes a `ui.json` offers. */
export function collectBypassCodes(uiJson, into = new Map()) {
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== "object") return

    if (node.id === BYPASS_CODE_FIELD_ID && Array.isArray(node.options)) {
      for (const option of node.options) {
        const code = typeof option === "string" ? option : option?.value
        if (typeof code !== "string") continue
        const label = typeof option?.label === "string" ? option.label : ""
        if (!into.has(code) || (!into.get(code) && label)) into.set(code, label)
      }
    }

    for (const value of Object.values(node)) walk(value)
  }
  walk(uiJson)
  return into
}

/** Collect the decision keys a `ui.json` offers, for `decisionOptions` (§5). */
export function collectDecisionOptions(uiJson, into = new Map()) {
  for (const option of uiJson?.decisionConfig?.options ?? []) {
    const key = typeof option === "string" ? option : option?.value
    if (typeof key !== "string" || key === "") continue
    const label = typeof option?.label === "string" ? option.label : ""
    if (!into.has(key) || (!into.get(key) && label)) into.set(key, label)
  }
  return into
}

/**
 * Merge v1's catalog with the codes bundles author.
 *
 * Returns the unified vocabulary plus the drift the merge removes, so the
 * report can name it rather than quietly fixing it.
 */
export function buildReasonCodeVocabulary({ catalog, authored, expected }) {
  const merged = new Map()

  for (const [code, label] of catalog) merged.set(code, label)
  for (const [code, label] of authored) {
    // Prefer a label that is actually present; bundles and catalog agree where both have one.
    if (!merged.get(code) && label) merged.set(code, label)
    else if (!merged.has(code)) merged.set(code, label)
  }

  const authoredNotInCatalog = [...authored.keys()]
    .filter((code) => !catalog.has(code))
    .sort()
  const catalogNeverAuthored = [...catalog.keys()]
    .filter((code) => !authored.has(code))
    .sort()
  const missingLabels = [...merged.entries()]
    .filter(([, label]) => !label)
    .map(([code]) => code)
    .sort()
  const expectedNotInVocabulary = [...expected]
    .filter((code) => !merged.has(code))
    .sort()

  if (expectedNotInVocabulary.length) {
    throw new VocabularyError(
      `Rubrics expect reason codes absent from both v1's catalog and every authored picker:\n` +
        expectedNotInVocabulary.map((code) => `  - ${code}`).join("\n")
    )
  }

  return {
    vocabulary: new Map(
      [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    ),
    drift: {
      authoredNotInCatalog,
      catalogNeverAuthored,
      missingLabels,
    },
  }
}
