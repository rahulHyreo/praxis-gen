/**
 * Assertion rules (task 7.3).
 *
 * Each rule is tested both ways: it fails on violating input and passes on
 * conforming input. The second direction is what the two no-op rules need most
 * — an assertion that cannot pass is indistinguishable from one that is never
 * reached, and both of those rules are expected to match nothing today.
 */

import { describe, expect, it } from "vitest"

import {
  ALLOWED_MODE_KEYS,
  ASSERTION_RULE_NAMES,
  ATTEMPT_MODE_KEYS,
  AssertionFailure,
  assertAnswerKeysConfined,
  assertNoFieldLevelVisibleWhen,
  assertNoLegacyModeKey,
  assertNoUnknownSourceFiles,
  assertReasonCodesResolve,
  assertVariantGradedValues,
} from "../lib/assertions.mjs"
import { data, navigator, result, state, ui } from "./fixtures.mjs"

const SECTION_CONDITION = { dataKey: "claim.status", equals: "Pended" }

describe("assert-no-field-level-visible-when", () => {
  it("accepts a section-level strict-equality condition", () => {
    const counts = assertNoFieldLevelVisibleWhen(
      ui({ visibleWhen: SECTION_CONDITION }),
      "fixture"
    )
    expect(counts.sectionLevel).toBe(1)
    expect(counts.fieldLevel).toBe(0)
  })

  it("accepts a ui.json with no conditions at all", () => {
    expect(assertNoFieldLevelVisibleWhen(ui(), "fixture").sectionLevel).toBe(0)
  })

  it("rejects a field-level condition, naming the field", () => {
    // v1 silently ignores this form, so an author's condition quietly does
    // nothing. v2 refuses to load it.
    expect(() =>
      assertNoFieldLevelVisibleWhen(
        ui({ fieldVisibleWhen: SECTION_CONDITION }),
        "fixture"
      )
    ).toThrow(/visibleWhen on a field/)
  })

  it("rejects a compound condition", () => {
    expect(() =>
      assertNoFieldLevelVisibleWhen(
        ui({ visibleWhen: { dataKey: "a", equals: "b", or: "c" } }),
        "fixture"
      )
    ).toThrow(/not a single strict-equality/)
  })

  it("rejects a condition using an operator other than equality", () => {
    expect(() =>
      assertNoFieldLevelVisibleWhen(
        ui({ visibleWhen: { dataKey: "a", notEquals: "b" } }),
        "fixture"
      )
    ).toThrow(AssertionFailure)
  })
})

describe("assert-no-legacy-mode-key", () => {
  it("passes on the three attempt modes and reports zero renames", () => {
    // The honest count: there is no legacy key in this source to rename.
    const outcome = assertNoLegacyModeKey(state(), "fixture")
    expect(outcome.renamed).toBe(0)
    expect(outcome.modeKeys).toEqual(ATTEMPT_MODE_KEYS)
  })

  it("accepts an unscored workspace mode", () => {
    // DEMO.1 configures `demo`. Asserting against flow_attempt_mode's three
    // would reject it; §16 lists five workspace modes.
    expect(() =>
      assertNoLegacyModeKey(
        state({ modeKeys: ["training", "practice", "assessment", "demo"] }),
        "fixture"
      )
    ).not.toThrow()
  })

  it("rejects the legacy assignment key", () => {
    expect(() =>
      assertNoLegacyModeKey(
        state({ modeKeys: ["training", "assignment"] }),
        "fixture"
      )
    ).toThrow(/legacy "assignment" mode key/)
  })

  it("rejects a mode key outside the workspace enum", () => {
    expect(() =>
      assertNoLegacyModeKey(
        state({ modeKeys: ["training", "sandbox"] }),
        "fixture"
      )
    ).toThrow(/unknown mode key/)
  })

  it("keeps the workspace and attempt enums distinct", () => {
    expect(ALLOWED_MODE_KEYS).toEqual([
      "training",
      "practice",
      "assessment",
      "embedded",
      "demo",
    ])
    expect(ATTEMPT_MODE_KEYS).toEqual(["training", "practice", "assessment"])
  })
})

describe("assert-variant-graded-values", () => {
  const bundle = (overrides = {}) => ({
    code: "TEST.1",
    variantName: "v2",
    navigatorJson: navigator(),
    dataJson: data({ subjectRef: "DCN-200002" }),
    uiJson: ui(),
    stateJson: state(),
    ...overrides,
  })

  it("accepts a step quoting a subject this variant serves", () => {
    const outcome = assertVariantGradedValues(
      bundle({ navigatorJson: navigator({ subjectRef: "DCN-200002" }) })
    )
    expect(outcome.checkedRefs).toBe(1)
  })

  it("rejects a step quoting another variant's subject", () => {
    // The W-DMX.2 class of defect: a carried variant navigator left naming the
    // wrong claim.
    expect(() =>
      assertVariantGradedValues(
        bundle({ navigatorJson: navigator({ subjectRef: "DCN-999999" }) })
      )
    ).toThrow(/names subject DCN-999999/)
  })

  it("accepts an expectation the trainee types, absent from the data", () => {
    // "70", "pay", a picker code. Requiring these in the data failed 224 of
    // v1's 456 bundles on valid content.
    expect(() =>
      assertVariantGradedValues(
        bundle({ navigatorJson: navigator({ expectedValue: "70" }) })
      )
    ).not.toThrow()
  })

  it("accepts a mismatch answer that a step expects", () => {
    // The 507.3 class: the variant's step expects RAUL because its data sets RAUL.
    expect(() =>
      assertVariantGradedValues(
        bundle({
          dataJson: data({
            subjectRef: "DCN-200002",
            mismatchCorrectValue: "RAUL",
          }),
          navigatorJson: navigator({ expectedValue: "RAUL" }),
        })
      )
    ).not.toThrow()
  })

  it("rejects a mismatch answer no step expects", () => {
    expect(() =>
      assertVariantGradedValues(
        bundle({
          dataJson: data({
            subjectRef: "DCN-200002",
            mismatchCorrectValue: "RAUL",
          }),
          navigatorJson: navigator({ expectedValue: "RICHARD" }),
        })
      )
    ).toThrow(/data and its graded steps disagree/)
  })

  it("rejects a step target that resolves to nothing", () => {
    expect(() =>
      assertVariantGradedValues(
        bundle({ navigatorJson: navigator({ targetFieldId: "f_missing" }) })
      )
    ).toThrow(/resolves to nothing/)
  })

  it("resolves a target that is an action id from state.json", () => {
    expect(() =>
      assertVariantGradedValues(
        bundle({
          navigatorJson: navigator({ completesActionId: "do_thing" }),
          stateJson: state({ actions: { do_thing: { label: "Do" } } }),
        })
      )
    ).not.toThrow()
  })
})

describe("assert-answer-keys-confined", () => {
  it("accepts subject data with no answer key", () => {
    expect(assertAnswerKeysConfined(data(), "fixture").reservedPaths).toEqual(
      []
    )
  })

  it("accepts an answer key at the reserved mismatch path", () => {
    // §13 assigns the randomization/mismatch block to data.json.
    const outcome = assertAnswerKeysConfined(
      data({ mismatchCorrectValue: "RICHARD" }),
      "fixture"
    )
    expect(outcome.reservedPaths).toEqual(["mismatch.fields[0].correctValue"])
  })

  it("rejects an answer key loose in subject data", () => {
    // data.json is served to trainees, so this would be an answer leak.
    expect(() =>
      assertAnswerKeysConfined(data({ strayAnswerKey: true }), "fixture")
    ).toThrow(/answer key "correctValue" at claim.correctValue/)
  })

  it("rejects an expected decision hidden in subject data", () => {
    expect(() =>
      assertAnswerKeysConfined(
        data({ extra: { grading: { expectedDecision: "pay" } } }),
        "fixture"
      )
    ).toThrow(/answer key "expectedDecision"/)
  })
})

describe("assert-unknown-source-files", () => {
  it("accepts a flow whose files are all accounted for", () => {
    expect(
      assertNoUnknownSourceFiles({
        code: "TEST.1",
        unknownFiles: [],
        variants: [],
      }).unknown
    ).toBe(0)
  })

  it("rejects an unaccounted file in the flow directory", () => {
    expect(() =>
      assertNoUnknownSourceFiles({
        code: "TEST.1",
        unknownFiles: ["notes.md"],
        variants: [],
      })
    ).toThrow(/notes\.md/)
  })

  it("rejects an unaccounted file inside a variant directory", () => {
    expect(() =>
      assertNoUnknownSourceFiles({
        code: "TEST.1",
        unknownFiles: [],
        variants: [{ name: "v2", unknownFiles: ["stray.json"] }],
      })
    ).toThrow(/v2\/: stray\.json/)
  })
})

describe("assert-reason-codes-resolve", () => {
  const vocabulary = new Set(["PX_R01030", "PX_R21410"])

  it("accepts a flow authoring one code it expects", () => {
    // All 23 of v1's deny flows author fewer than 5 codes; padding to
    // MIN_REJECT_CODE_OPTIONS is server-side, so no count is asserted here.
    const outcome = assertReasonCodesResolve({
      code: "TEST.1",
      uiJson: ui({ rejectCodes: ["PX_R01030"] }),
      resultJson: result({ expectedReasonCode: "PX_R01030" }),
      vocabulary,
    })
    expect(outcome.authored).toBe(1)
    expect(outcome.expected).toBe("PX_R01030")
  })

  it("accepts a flow with no reason code at all", () => {
    expect(() =>
      assertReasonCodesResolve({
        code: "TEST.1",
        uiJson: ui(),
        resultJson: result({ expectedReasonCode: "" }),
        vocabulary,
      })
    ).not.toThrow()
  })

  it("rejects an authored code outside the vocabulary", () => {
    expect(() =>
      assertReasonCodesResolve({
        code: "TEST.1",
        uiJson: ui({ rejectCodes: ["PX_UNKNOWN"] }),
        resultJson: result({ expectedReasonCode: "" }),
        vocabulary,
      })
    ).toThrow(/absent from the pack's reason-code vocabulary/)
  })

  it("rejects an expectation its own flow does not offer", () => {
    // Otherwise the correct answer is unreachable in the picker.
    expect(() =>
      assertReasonCodesResolve({
        code: "TEST.1",
        uiJson: ui({ rejectCodes: ["PX_R01030"] }),
        resultJson: result({ expectedReasonCode: "PX_R21410" }),
        vocabulary,
      })
    ).toThrow(/does not offer it, so the expectation is unreachable/)
  })
})

describe("assertion registry", () => {
  it("names every assertion the report counts", () => {
    expect(ASSERTION_RULE_NAMES).toEqual([
      "assert-no-field-level-visible-when",
      "assert-no-legacy-mode-key",
      "assert-variant-graded-values",
      "assert-answer-keys-confined",
      "assert-unknown-source-files",
      "assert-reason-codes-resolve",
    ])
  })
})
