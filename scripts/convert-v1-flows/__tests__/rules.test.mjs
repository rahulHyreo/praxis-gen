/**
 * Transform rules (task 7.2).
 *
 * One test per rule asserting its output, plus a test per rule that it leaves
 * unrelated content alone. The second half matters as much as the first: a rule
 * that quietly rewrites something it was not asked to touch is the failure mode
 * a 930-file diff hides best.
 */

import { describe, expect, it } from "vitest"

import {
  TRANSFORM_RULE_NAMES,
  decideVariantFile,
  declareBespokeComponents,
  isDuplicateOfBase,
  nullDecision,
  planOrphanRemovals,
  stripPassMark,
} from "../lib/rules.mjs"
import { result, ui } from "./fixtures.mjs"

describe("drop-duplicate-variant-files", () => {
  it("treats a variant file equal to base as a duplicate", () => {
    const base = { a: 1, b: [2, 3] }
    const variant = { a: 1, b: [2, 3] }
    expect(isDuplicateOfBase(variant, base)).toBe(true)
  })

  it("ignores key order and whitespace, so a reformatted copy is still a copy", () => {
    // 152 of v1's variant navigators differ byte-wise but not semantically. A
    // byte comparison would have carried every one of them.
    const base = { a: 1, nested: { x: 1, y: 2 } }
    const reformatted = { nested: { y: 2, x: 1 }, a: 1 }
    expect(isDuplicateOfBase(reformatted, base)).toBe(true)
  })

  it("does not treat a different array order as a duplicate", () => {
    // Order is meaning in a navigator's steps.
    expect(isDuplicateOfBase({ steps: [1, 2] }, { steps: [2, 1] })).toBe(false)
  })

  it("drops a duplicate and names the rule", () => {
    const decision = decideVariantFile({
      variantJson: { a: 1 },
      baseJson: { a: 1 },
      isLive: true,
    })
    expect(decision.carry).toBe(false)
    expect(decision.rule).toBe("drop-duplicate-variant-files")
  })
})

describe("drop-dead-variant-files", () => {
  it("drops a file that differs but was never bound", () => {
    // X4.1's variant ui.json: distinct, so a duplicate check alone would carry
    // it, but v1 binds the base copy — carrying it would change what a trainee sees.
    const decision = decideVariantFile({
      variantJson: { a: 2 },
      baseJson: { a: 1 },
      isLive: false,
    })
    expect(decision.carry).toBe(false)
    expect(decision.rule).toBe("drop-dead-variant-files")
    expect(decision.reason).toMatch(/never served|dead content/i)
  })

  it("carries a file that is both distinct and live", () => {
    // 507.3's navigator, W-DMX.2's state.
    const decision = decideVariantFile({
      variantJson: { a: 2 },
      baseJson: { a: 1 },
      isLive: true,
    })
    expect(decision.carry).toBe(true)
    expect(decision.rule).toBeNull()
  })

  it("prefers the duplicate reason when a file is both duplicate and dead", () => {
    const decision = decideVariantFile({
      variantJson: { a: 1 },
      baseJson: { a: 1 },
      isLive: false,
    })
    expect(decision.rule).toBe("drop-duplicate-variant-files")
  })
})

describe("null-decision", () => {
  it("maps an empty expected decision to null", () => {
    const { json, transforms } = nullDecision(
      result({ expectedDecision: "", expectedReasonCode: "PX_R01030" })
    )
    expect(json.rubric.expectedDecision).toBeNull()
    expect(transforms).toHaveLength(1)
    expect(transforms[0]).toMatchObject({
      rule: "null-decision",
      path: "rubric.expectedDecision",
      from: "",
      to: null,
    })
  })

  it("maps an empty expected reason code to null", () => {
    const { json, transforms } = nullDecision(
      result({ expectedDecision: "pay", expectedReasonCode: "" })
    )
    expect(json.rubric.expectedReasonCode).toBeNull()
    expect(transforms).toHaveLength(1)
    expect(transforms[0].path).toBe("rubric.expectedReasonCode")
  })

  it("maps both when both are empty", () => {
    // 088.1 and the other no-decision flows author both as "".
    const { json, transforms } = nullDecision(
      result({ expectedDecision: "", expectedReasonCode: "" })
    )
    expect(json.rubric.expectedDecision).toBeNull()
    expect(json.rubric.expectedReasonCode).toBeNull()
    expect(transforms).toHaveLength(2)
  })

  it("distinguishes a null expectation from a missing one", () => {
    // The non-negotiable: null is a CORRECT answer, not an unanswered one.
    const { json } = nullDecision(result({ expectedDecision: "" }))
    expect("expectedDecision" in json.rubric).toBe(true)
    expect(json.rubric.expectedDecision).toBeNull()
  })

  it("leaves a real decision key untouched", () => {
    const source = result({
      expectedDecision: "deny",
      expectedReasonCode: "PX_R01030",
    })
    const { json, transforms } = nullDecision(source)
    expect(json.rubric.expectedDecision).toBe("deny")
    expect(json.rubric.expectedReasonCode).toBe("PX_R01030")
    expect(transforms).toHaveLength(0)
    expect(json).toBe(source)
  })

  it("leaves weights, deductions and the result config untouched", () => {
    const source = result({ expectedDecision: "" })
    const { json } = nullDecision(source)
    expect(json.rubric.weights).toEqual(source.rubric.weights)
    expect(json.rubric.deductions).toEqual(source.rubric.deductions)
    expect(json.resultConfig).toEqual(source.resultConfig)
  })
})

describe("strip-pass-mark", () => {
  it("removes passMark and reports the observed value", () => {
    const { json, passMark } = stripPassMark(result({ passMark: 70 }))
    expect("passMark" in json.rubric).toBe(false)
    expect(passMark).toBe(70)
  })

  it("reports a zero pass mark rather than treating it as absent", () => {
    // DEMO.1 authors 0 — an unscored flow, not a missing value.
    const { json, passMark } = stripPassMark(result({ passMark: 0 }))
    expect(passMark).toBe(0)
    expect("passMark" in json.rubric).toBe(false)
  })

  it("leaves authored weights and deductions in place", () => {
    // §45.1 assigns rubric weights to result.json, authored per flow.
    const weights = { navigator: 140, decision: 20, reasonCode: 10 }
    const { json } = stripPassMark(result({ passMark: 70, weights }))
    expect(json.rubric.weights).toEqual(weights)
    expect(json.rubric.deductions).toBeDefined()
  })

  it("is a no-op when there is no pass mark to strip", () => {
    const source = result({ passMark: null })
    const { json, passMark, transforms } = stripPassMark(source)
    expect(passMark).toBeUndefined()
    expect(transforms).toHaveLength(0)
    expect(json).toBe(source)
  })
})

describe("declare-bespoke-components", () => {
  const bindings = { subtab_search_claims: { component: "ClaimsSearchSubTab" } }

  it("writes the component name onto the bound sub-tab", () => {
    const { json, declarations } = declareBespokeComponents(ui(), bindings)
    expect(json.tabs[0].subTabs[0].component).toBe("ClaimsSearchSubTab")
    expect(declarations).toHaveLength(1)
  })

  it("collects every declared sub-tab id, bound or not", () => {
    // The ids are what prove a binding is reachable.
    const { declaredSubTabIds } = declareBespokeComponents(
      ui({ subTabId: "subtab_other" }),
      bindings
    )
    expect([...declaredSubTabIds]).toEqual(["subtab_other"])
  })

  it("infers nothing for an unbound sub-tab", () => {
    const source = ui({ subTabId: "subtab_not_bespoke" })
    const { json, declarations } = declareBespokeComponents(source, bindings)
    expect(json.tabs[0].subTabs[0].component).toBeUndefined()
    expect(declarations).toHaveLength(0)
    expect(json).toBe(source)
  })

  it("leaves sections, fields and decision config untouched", () => {
    const source = ui()
    const { json } = declareBespokeComponents(source, bindings)
    expect(json.tabs[0].subTabs[0].sections).toEqual(
      source.tabs[0].subTabs[0].sections
    )
    expect(json.decisionConfig).toEqual(source.decisionConfig)
  })
})

describe("prune-orphaned-output", () => {
  it("removes output the source no longer explains", () => {
    const removals = planOrphanRemovals({
      existingPaths: ["flows/A/ui.json", "flows/GONE/ui.json"],
      expectedPaths: ["flows/A/ui.json"],
    })
    expect(removals).toHaveLength(1)
    expect(removals[0]).toMatchObject({
      path: "flows/GONE/ui.json",
      rule: "prune-orphaned-output",
    })
  })

  it("keeps everything the source still explains", () => {
    const removals = planOrphanRemovals({
      existingPaths: ["flows/A/ui.json"],
      expectedPaths: ["flows/A/ui.json", "flows/B/ui.json"],
    })
    expect(removals).toEqual([])
  })
})

describe("rule registry", () => {
  it("names every rule the report counts", () => {
    // The report prints a row per name, including zeros, so a rule missing here
    // would be applied without ever being reported.
    expect(TRANSFORM_RULE_NAMES).toEqual([
      "drop-duplicate-variant-files",
      "drop-dead-variant-files",
      "null-decision",
      "strip-pass-mark",
      "declare-bespoke-components",
      "extract-subject-index",
      "prune-orphaned-output",
    ])
  })
})
