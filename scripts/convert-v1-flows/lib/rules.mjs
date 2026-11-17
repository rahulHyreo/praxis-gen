/**
 * Transform rules (tasks 3.1–3.6).
 *
 * Each rule is a named export, so each is separately testable and the report
 * can count them individually. A rule either transforms, drops or asserts —
 * it never passes content through while reporting that it acted, which is why
 * the no-op rules live in assertions.mjs rather than pretending to transform.
 */

import { isSemanticallyEqual } from "./normalize.mjs"

export const TRANSFORM_RULE_NAMES = [
  "drop-duplicate-variant-files",
  "drop-dead-variant-files",
  "null-decision",
  "strip-pass-mark",
  "declare-bespoke-components",
  "extract-subject-index",
  "prune-orphaned-output",
]

/* ------------------------------------------------------------------ 3.1 + 3.2 */

/** A variant file equal to its base after normalization is a copy (D4). */
export function isDuplicateOfBase(variantJson, baseJson) {
  return isSemanticallyEqual(variantJson, baseJson)
}

/**
 * Decide whether one variant file is carried into the pack.
 *
 * Carried only when it is both DISTINCT from base and LIVE in v1 (design D2).
 * The two questions are independent, and all three failing combinations occur
 * in the source — see lib/reachability.mjs.
 */
export function decideVariantFile({ variantJson, baseJson, isLive }) {
  if (isDuplicateOfBase(variantJson, baseJson)) {
    return {
      carry: false,
      rule: "drop-duplicate-variant-files",
      reason: "identical to the flow's base file after JSON normalization",
    }
  }
  if (!isLive) {
    return {
      carry: false,
      rule: "drop-dead-variant-files",
      reason:
        "differs from base but v1's index.ts binds the base copy for this variant, " +
        "so v1 never served it — dead content",
    }
  }
  return { carry: true, rule: null, reason: null }
}

/* ------------------------------------------------------------------------ 3.3 */

/**
 * Empty-string answer keys become `null` (design D5).
 *
 * v1 writes `expectedDecision: ""` for a correct no-decision answer. An empty
 * string invites later code to read a correct answer as "didn't answer", which
 * the non-negotiables forbid. `expectedReasonCode: ""` is the same defect —
 * an empty string standing in for "no code expected" — and it must be `null`
 * for the vocabulary check to mean anything.
 */
export function nullDecision(resultJson) {
  const rubric = resultJson?.rubric
  if (!rubric) return { json: resultJson, transforms: [] }

  const transforms = []
  const nextRubric = { ...rubric }

  for (const field of ["expectedDecision", "expectedReasonCode"]) {
    if (nextRubric[field] === "") {
      nextRubric[field] = null
      transforms.push({
        rule: "null-decision",
        path: `rubric.${field}`,
        from: "",
        to: null,
      })
    }
  }

  if (transforms.length === 0) return { json: resultJson, transforms: [] }
  return { json: { ...resultJson, rubric: nextRubric }, transforms }
}

/* ------------------------------------------------------------------------ 3.4 */

/**
 * The flow pass mark leaves pack content (design D6).
 *
 * §45.2 moves v1's `FLOW_PASS_MARK_PCT = 70` to the governance-owned
 * `pass_standards` surface, so carrying it in `result.json` would be a
 * hard-coded pass mark. Weights, deductions and caps stay: §45.1 assigns those
 * to `result.json`, authored per flow.
 */
export function stripPassMark(resultJson) {
  const rubric = resultJson?.rubric
  if (!rubric || !("passMark" in rubric)) {
    return { json: resultJson, passMark: undefined, transforms: [] }
  }

  const passMark = rubric.passMark
  const { passMark: _removed, ...rest } = rubric

  return {
    json: { ...resultJson, rubric: rest },
    passMark,
    transforms: [
      {
        rule: "strip-pass-mark",
        path: "rubric.passMark",
        from: passMark,
        to: undefined,
      },
    ],
  }
}

/* ------------------------------------------------------------------------ 3.5 */

/**
 * Lift v1's hidden sub-tab → component bindings into the bundle (design D7).
 *
 * No v1 `ui.json` names the component that renders a sub-tab; v1 keeps that in
 * a web-app map. Rendering configuration is pack data (§5), so it is written
 * here. Nothing is inferred: a sub-tab absent from the map gains no component.
 */
export function declareBespokeComponents(uiJson, bindings) {
  const declaredSubTabIds = new Set()
  const declarations = []
  let changed = false

  const tabs = Array.isArray(uiJson?.tabs) ? uiJson.tabs : []

  const nextTabs = tabs.map((tab) => {
    const subTabs = Array.isArray(tab?.subTabs) ? tab.subTabs : null
    if (!subTabs) return tab

    let tabChanged = false
    const nextSubTabs = subTabs.map((subTab) => {
      if (typeof subTab?.id !== "string") return subTab
      declaredSubTabIds.add(subTab.id)

      const binding = bindings[subTab.id]
      if (!binding) return subTab

      tabChanged = true
      declarations.push({
        rule: "declare-bespoke-components",
        subTabId: subTab.id,
        component: binding.component,
      })
      return { ...subTab, component: binding.component }
    })

    if (!tabChanged) return tab
    changed = true
    return { ...tab, subTabs: nextSubTabs }
  })

  return {
    json: changed ? { ...uiJson, tabs: nextTabs } : uiJson,
    declaredSubTabIds,
    declarations,
  }
}

/* ------------------------------------------------------------------------ 3.6 */

/**
 * Output that the source no longer explains is removed (task 3.6).
 *
 * Without this a re-run after a flow is deleted upstream would leave the old
 * flow in the pack, and the pack would drift from its source while every other
 * check still passed.
 */
export function planOrphanRemovals({ existingPaths, expectedPaths }) {
  const expected = new Set(expectedPaths)
  return [...existingPaths]
    .filter((path) => !expected.has(path))
    .sort()
    .map((path) => ({
      path,
      rule: "prune-orphaned-output",
      reason: "no longer present in the v1 source",
    }))
}
