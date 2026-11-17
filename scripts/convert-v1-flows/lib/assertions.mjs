/**
 * Assertion rules (tasks 4.1–4.6).
 *
 * Two of these are expected to match NOTHING. §46 lists three defects for the
 * migration to fix, and on this source two of them do not exist: there is no
 * field-level `visibleWhen` and no legacy `assignment` mode key. A rule that
 * "renamed" a key it never found would be a lie in the report, so these assert
 * instead, and the report records them as applied 0 times. They earn their
 * place by failing if a future v1 edit introduces one.
 */

export class AssertionFailure extends Error {}

export const ASSERTION_RULE_NAMES = [
  "assert-no-field-level-visible-when",
  "assert-no-legacy-mode-key",
  "assert-variant-graded-values",
  "assert-answer-keys-confined",
  "assert-unknown-source-files",
  "assert-reason-codes-resolve",
]

/**
 * Mode keys a `state.json` may configure (§16).
 *
 * Two enums, deliberately not conflated. `modeConfig` configures WORKSPACE
 * modes, five of them; `flow_attempt_mode` is the narrower attempt enum, and
 * only the first three appear in it because `embedded` and `demo` are unscored
 * and so never produce an attempt. `DEMO.1` configures `demo` for exactly that
 * reason, and asserting against the attempt enum would wrongly reject it.
 *
 * `assignment` is in neither: §16 drops it along with v1's twin `training_mode`
 * enum.
 */
export const ALLOWED_MODE_KEYS = [
  "training",
  "practice",
  "assessment",
  "embedded",
  "demo",
]
export const ATTEMPT_MODE_KEYS = ["training", "practice", "assessment"]
export const LEGACY_MODE_KEY = "assignment"

/** Answer-key field names (§13). */
export const ANSWER_KEY_FIELDS = [
  "expectedDecision",
  "expectedReasonCode",
  "expectedValue",
  "correctValue",
]

/**
 * The one path in `data.json` where §13 authorizes an answer key: the reserved
 * randomization / mismatch block, whose `correctValue` is the value the trainee
 * must restore. Every one of the 27 occurrences in the source sits here.
 */
const RESERVED_ANSWER_KEY_PATH = /^mismatch\.fields\[\d+\]\.correctValue$/

/* ------------------------------------------------------------------------ 4.1 */

/**
 * `visibleWhen` is section-level and a single strict equality (§13, §14.1).
 *
 * Containment decides the level, not a guess from the node's shape: a
 * `visibleWhen` on an element of a `fields` array is field-level, on an element
 * of a `sections` array it is section-level. v1 silently ignores the
 * field-level form; v2 rejects it, so a condition an author believed was
 * applied can never quietly do nothing.
 */
export function assertNoFieldLevelVisibleWhen(uiJson, label) {
  let sectionLevel = 0

  const walk = (node, container, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, container, `${path}[${index}]`))
      return
    }
    if (!node || typeof node !== "object") return

    if ("visibleWhen" in node) {
      if (container !== "section") {
        throw new AssertionFailure(
          `${label}: visibleWhen on a ${container} at ${path} (id=${node.id ?? "?"}). ` +
            `Only section-level visibleWhen is allowed (§13, §14.1); v1 silently ignores the rest.`
        )
      }

      const condition = node.visibleWhen
      const keys = Object.keys(condition ?? {}).sort()
      const isStrictEquality =
        keys.length === 2 && keys[0] === "dataKey" && keys[1] === "equals"

      if (!isStrictEquality) {
        throw new AssertionFailure(
          `${label}: visibleWhen at ${path} (id=${node.id ?? "?"}) is not a single strict-equality ` +
            `comparison — found keys [${keys.join(", ")}], expected [dataKey, equals] (§13).`
        )
      }

      sectionLevel += 1
    }

    for (const [key, value] of Object.entries(node)) {
      const nextContainer =
        key === "sections"
          ? "section"
          : key === "fields"
            ? "field"
            : key === "subTabs"
              ? "subTab"
              : key === "tabs"
                ? "tab"
                : container
      walk(value, nextContainer, path ? `${path}.${key}` : key)
    }
  }

  walk(uiJson, "root", "")
  return { sectionLevel, fieldLevel: 0 }
}

/* ------------------------------------------------------------------------ 4.2 */

/** Mode configuration uses only `flow_attempt_mode` keys (§16). */
export function assertNoLegacyModeKey(stateJson, label) {
  const modeConfig = stateJson?.modeConfig
  if (!modeConfig || typeof modeConfig !== "object") {
    return { renamed: 0, modeKeys: [] }
  }

  const modeKeys = Object.keys(modeConfig)

  if (modeKeys.includes(LEGACY_MODE_KEY)) {
    throw new AssertionFailure(
      `${label}: state.json declares the legacy "${LEGACY_MODE_KEY}" mode key, which §16 drops ` +
        `along with v1's twin training_mode enum. Workspace modes are ` +
        `${ALLOWED_MODE_KEYS.join(" | ")}; attempts use ${ATTEMPT_MODE_KEYS.join(" | ")}.`
    )
  }

  const unknown = modeKeys.filter((key) => !ALLOWED_MODE_KEYS.includes(key))
  if (unknown.length) {
    throw new AssertionFailure(
      `${label}: state.json declares unknown mode key(s) [${unknown.join(", ")}]. ` +
        `§16 admits ${ALLOWED_MODE_KEYS.join(" | ")}.`
    )
  }

  // 0 is the honest count: the source has no legacy key to rename.
  return { renamed: 0, modeKeys }
}

/* ------------------------------------------------------------------------ 4.3 */

/**
 * Subject references inside a graded or narrative string.
 *
 * The pack's subject-ref form (§40). A ref naming another variant's subject is
 * the concrete shape of "variants contradict themselves": the step text or
 * expectation would point at a claim this variant does not serve.
 */
const SUBJECT_REF_PATTERN = /DCN-\d+/g

/** Step fields that may quote a subject ref. */
const REF_BEARING_STEP_FIELDS = [
  "expectedValue",
  "description",
  "hint",
  "completionTriggerNote",
]

/** Ids a navigator step may target, gathered from the ui that serves it. */
function collectTargetableIds(uiJson, stateJson) {
  const ids = new Set()
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== "object") return
    if (typeof node.id === "string") ids.add(node.id)
    for (const value of Object.values(node)) walk(value)
  }
  walk(uiJson)
  for (const actionId of Object.keys(stateJson?.actions ?? {}))
    ids.add(actionId)
  return ids
}

/**
 * Graded values are validated against the data of the variant they grade
 * (§13, variant provider identity).
 *
 * This is the check that makes per-variant navigators safe to carry: a step
 * expecting RAUL is only correct if RAUL is what that variant's data shows.
 * A flow whose variants contradict themselves fails rather than shipping a
 * step no trainee can complete.
 */
export function assertVariantGradedValues({
  code,
  variantName,
  navigatorJson,
  dataJson,
  uiJson,
  stateJson,
}) {
  const label = `${code}${variantName ? `/${variantName}` : ""}`
  const steps = Array.isArray(navigatorJson?.steps) ? navigatorJson.steps : []
  const targetableIds = collectTargetableIds(uiJson, stateJson)
  const dataBlob = JSON.stringify(dataJson)

  let checkedRefs = 0
  let checkedTargets = 0
  let checkedMismatches = 0

  for (const step of steps) {
    // A subject ref quoted by a step must belong to the variant being served.
    // NOT a check that `expectedValue` appears in the data: an expectation is
    // what the trainee TYPES or SELECTS — "70", "pay", a picker code — and most
    // are nowhere in the subject data by design.
    for (const field of REF_BEARING_STEP_FIELDS) {
      const value = step?.[field]
      if (typeof value !== "string") continue
      for (const ref of value.match(SUBJECT_REF_PATTERN) ?? []) {
        checkedRefs += 1
        if (!dataBlob.includes(ref)) {
          throw new AssertionFailure(
            `${label}: navigator step ${step.id ?? "?"} ${field} names subject ${ref}, ` +
              `which this variant's data does not contain. The variant contradicts itself ` +
              `(§13, variant provider identity).`
          )
        }
      }
    }

    for (const field of [
      "targetTabId",
      "targetSubTabId",
      "targetSectionId",
      "targetFieldId",
      "completesActionId",
    ]) {
      const value = step?.[field]
      if (typeof value !== "string" || value === "") continue
      checkedTargets += 1
      if (!targetableIds.has(value)) {
        throw new AssertionFailure(
          `${label}: navigator step ${step.id ?? "?"} ${field} "${value}" ` +
            `resolves to nothing in the bundle served for this variant.`
        )
      }
    }
  }

  // A reserved mismatch block's answer must be the answer some step expects.
  // This is where 507.3's per-variant navigator earns its keep: the variant's
  // step expects RAUL because the variant's data sets RAUL.
  const mismatchFields = dataJson?.mismatch?.fields
  if (Array.isArray(mismatchFields)) {
    const expectations = steps
      .map((step) => step?.expectedValue)
      .filter((value) => typeof value === "string" && value !== "")

    for (const field of mismatchFields) {
      if (typeof field?.correctValue !== "string") continue
      checkedMismatches += 1
      if (expectations.length === 0) continue
      if (!expectations.includes(field.correctValue)) {
        throw new AssertionFailure(
          `${label}: the reserved mismatch field ${field.id ?? "?"} sets correctValue ` +
            `"${field.correctValue}", but no navigator step serving this variant expects it. ` +
            `The variant's data and its graded steps disagree (§13, variant provider identity).`
        )
      }
    }
  }

  return { checkedRefs, checkedTargets, checkedMismatches }
}

/* ------------------------------------------------------------------------ 4.4 */

/**
 * Answer keys stay out of subject data, except the reserved block (§13).
 *
 * `data.json` is served to trainees, so an answer key loose in it is an answer
 * leak. The reserved mismatch block is the one place §13 assigns one, and
 * recording those paths is what lets the trainee-role strip be shown to cover
 * them.
 */
export function assertAnswerKeysConfined(dataJson, label) {
  const reservedPaths = []

  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`))
      return
    }
    if (!node || typeof node !== "object") return

    for (const [key, value] of Object.entries(node)) {
      const childPath = path ? `${path}.${key}` : key

      if (ANSWER_KEY_FIELDS.includes(key)) {
        if (RESERVED_ANSWER_KEY_PATH.test(childPath)) {
          reservedPaths.push(childPath)
        } else {
          throw new AssertionFailure(
            `${label}: answer key "${key}" at ${childPath} in subject data. ` +
              `data.json is served to trainees, so an answer key may only sit at the reserved ` +
              `randomization/mismatch path mismatch.fields[N].correctValue (§13).`
          )
        }
      }

      walk(value, childPath)
    }
  }

  walk(dataJson, "")
  return { reservedPaths }
}

/* ------------------------------------------------------------------------ 4.5 */

/** No file in a source flow directory goes unaccounted for (task 4.5). */
export function assertNoUnknownSourceFiles(flow) {
  const problems = []

  if (flow.unknownFiles?.length) {
    problems.push(`  ${flow.code}/: ${flow.unknownFiles.join(", ")}`)
  }
  for (const variant of flow.variants ?? []) {
    if (variant.unknownFiles?.length) {
      problems.push(
        `  ${flow.code}/${variant.name}/: ${variant.unknownFiles.join(", ")}`
      )
    }
  }

  if (problems.length) {
    throw new AssertionFailure(
      `Files in the v1 source that no conversion rule accounts for:\n` +
        problems.join("\n") +
        `\nRefusing to copy them blindly or drop them silently — decide what they are first.`
    )
  }

  return { unknown: 0 }
}

/* ------------------------------------------------------------------------ 4.6 */

/**
 * Reason codes resolve against the pack vocabulary (design D10).
 *
 * Deliberately NOT a check that a picker offers `MIN_REJECT_CODE_OPTIONS = 5`.
 * That minimum is server-side padding from the pack's pool: flows author only
 * the codes they expect, 1 to 3 of them, and all 23 deny flows are under 5. A
 * bundle-level count would fail every one of them.
 */
export function assertReasonCodesResolve({
  code,
  uiJson,
  resultJson,
  vocabulary,
}) {
  const authored = (uiJson?.denyConfig?.rejectCodes ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.code))
    .filter((value) => typeof value === "string")

  for (const reasonCode of authored) {
    if (!vocabulary.has(reasonCode)) {
      throw new AssertionFailure(
        `${code}: ui.json authors reject code "${reasonCode}", which is absent from the pack's ` +
          `reason-code vocabulary. Reason codes are pack-authored (§5).`
      )
    }
  }

  const expected = resultJson?.rubric?.expectedReasonCode

  if (typeof expected === "string" && expected !== "") {
    if (!vocabulary.has(expected)) {
      throw new AssertionFailure(
        `${code}: rubric expects reason code "${expected}", which is absent from the pack's ` +
          `reason-code vocabulary (§5).`
      )
    }
    if (!authored.includes(expected)) {
      throw new AssertionFailure(
        `${code}: rubric expects reason code "${expected}", but the flow's own picker does not ` +
          `offer it, so the expectation is unreachable.`
      )
    }
  }

  return { authored: authored.length, expected: expected ?? null }
}
