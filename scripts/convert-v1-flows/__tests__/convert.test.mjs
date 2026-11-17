/**
 * End-to-end conversion (tasks 7.4–7.7).
 *
 * Runs the real pipeline over a fixture v1 repo and inspects what lands on
 * disk. The converter's contract is about files, so these tests read the files.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { convert } from "../lib/convert.mjs"
import { assertSourceReadable, parseArgs } from "../lib/cli.mjs"
import { PACK_FILES } from "../lib/manifest.mjs"
import {
  cleanup,
  conformingFlow,
  data,
  makeTempDir,
  navigator,
  result,
  state,
  ui,
  writeV1Repo,
} from "./fixtures.mjs"

const temps = []
const track = (dir) => {
  temps.push(dir)
  return dir
}

afterEach(() => {
  while (temps.length) cleanup(temps.pop())
})

/**
 * `pins: null` skips the two assertions that describe v1's real tree — 92
 * flows, and per-variant navigators only in 507.3 and W-DMX.2. Those guard
 * against v1 changing under the converter; a fixture is a different tree, so
 * skipping them is the point rather than a workaround.
 */
async function run({ flows, catalogCodes, subTabId, outputRoot, pins = null }) {
  const repo = writeV1Repo({ flows, catalogCodes, subTabId })
  track(repo.v1Root)
  const out = outputRoot ?? track(makeTempDir("pack-"))
  const outcome = await convert({
    sourceRoot: repo.sourceRoot,
    outputRoot: out,
    bespokeMapPath: repo.bespokeMapPath,
    catalogPath: repo.catalogPath,
    pins,
  })
  return { ...repo, outputRoot: out, outcome }
}

const readJson = (root, relativePath) =>
  JSON.parse(readFileSync(join(root, ...relativePath.split("/")), "utf8"))

const readReport = (outputRoot) =>
  readFileSync(join(outputRoot, PACK_FILES.report), "utf8")

describe("conversion output", () => {
  it("writes the five bundle files plus flow metadata for each flow", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })

    for (const file of [
      "ui.json",
      "data.json",
      "navigator.json",
      "state.json",
      "result.json",
      "flow.json",
    ]) {
      expect(
        existsSync(join(outputRoot, "flows", "TEST.1", file)),
        `flows/TEST.1/${file} should exist`
      ).toBe(true)
    }
    expect(existsSync(join(outputRoot, PACK_FILES.manifest))).toBe(true)
    expect(existsSync(join(outputRoot, PACK_FILES.glossary))).toBe(true)
    expect(existsSync(join(outputRoot, PACK_FILES.report))).toBe(true)
  })

  it("drops a variant file that duplicates its base", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [{ name: "v2", subjectRefs: ["DCN-200002"] }],
        }),
      ],
    })

    // Only data varies, so only data.json is carried.
    expect(
      existsSync(join(outputRoot, "flows", "TEST.1", "v2", "data.json"))
    ).toBe(true)
    for (const file of [
      "ui.json",
      "navigator.json",
      "state.json",
      "result.json",
    ]) {
      expect(
        existsSync(join(outputRoot, "flows", "TEST.1", "v2", file)),
        `v2/${file} duplicates base and should not be written`
      ).toBe(false)
    }
  })

  it("carries a variant file that is distinct and live", async () => {
    // 507.3's navigator: its own, and bound by index.ts.
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [
            {
              name: "v2",
              subjectRefs: ["DCN-200002"],
              bindings: { data: true, navigator: true },
              navigator: navigator({ expectedValue: "RAUL" }),
              data: data({
                subjectRef: "DCN-200002",
                mismatchCorrectValue: "RAUL",
              }),
            },
          ],
        }),
      ],
    })

    const carried = readJson(outputRoot, "flows/TEST.1/v2/navigator.json")
    expect(carried.steps[0].expectedValue).toBe("RAUL")
  })

  it("drops a variant file that is distinct but never bound", async () => {
    // X4.1's variant ui.json: differs from base, but v1 binds the base copy,
    // so carrying it would change what a trainee sees.
    const { outputRoot, outcome } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [
            {
              name: "v2",
              subjectRefs: ["DCN-200002"],
              bindings: { data: true, ui: false },
              ui: ui({ name: "A different ui that v1 never serves" }),
            },
          ],
        }),
      ],
    })

    expect(
      existsSync(join(outputRoot, "flows", "TEST.1", "v2", "ui.json"))
    ).toBe(false)
    expect(readReport(outputRoot)).toContain("drop-dead-variant-files")
    expect(outcome.drops).toBeGreaterThan(0)
  })

  it("records what diverges in a carried variant file", async () => {
    // The evidence for the §13 departure: the report must show the graded value.
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [
            {
              name: "v2",
              subjectRefs: ["DCN-200002"],
              bindings: { data: true, navigator: true },
              navigator: navigator({ expectedValue: "RAUL" }),
              data: data({
                subjectRef: "DCN-200002",
                mismatchCorrectValue: "RAUL",
              }),
            },
          ],
        }),
      ],
    })

    const report = readReport(outputRoot)
    expect(report).toContain("Carried variant files")
    expect(report).toContain("steps.0.expectedValue")
    expect(report).toContain("RAUL")
  })
})

describe("no-decision path (task 7.6)", () => {
  it("writes a null expected decision, never an empty string", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          result: result({ expectedDecision: "", expectedReasonCode: "" }),
        }),
      ],
    })

    const written = readJson(outputRoot, "flows/TEST.1/result.json")
    expect(written.rubric.expectedDecision).toBeNull()
    expect(written.rubric.expectedReasonCode).toBeNull()
  })

  it("keeps a null expectation present, so it reads as correct not missing", async () => {
    // The non-negotiable: NULL is a valid CORRECT answer. An absent key would
    // read as "this flow has no expectation".
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", { result: result({ expectedDecision: "" }) }),
      ],
    })

    const written = readJson(outputRoot, "flows/TEST.1/result.json")
    expect("expectedDecision" in written.rubric).toBe(true)
    expect(written.rubric.expectedDecision).toBeNull()
  })

  it("scores a no-decision submission as a match against a null expectation", async () => {
    // NULL == NULL is a match (§18). A trainee who records no decision has
    // answered correctly, and the stored decision is null, not absent.
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", { result: result({ expectedDecision: "" }) }),
      ],
    })
    const { rubric } = readJson(outputRoot, "flows/TEST.1/result.json")

    const submittedDecision = null
    expect(submittedDecision === rubric.expectedDecision).toBe(true)
    expect("expectedDecision" in rubric).toBe(true)
  })

  it("declares that the pack allows a no-decision answer", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    expect(readJson(outputRoot, PACK_FILES.manifest).allowsNoDecision).toBe(
      true
    )
  })
})

describe("answer-key boundary (task 7.7)", () => {
  it("keeps answer keys only in the files a trainee response strips", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          result: result({
            expectedDecision: "deny",
            expectedReasonCode: "PX_R01030",
          }),
          ui: ui({ rejectCodes: ["PX_R01030"] }),
          navigator: navigator({ expectedValue: "70" }),
        }),
      ],
      catalogCodes: [["PX_R01030", "Coverage terminated"]],
    })

    expect(
      readJson(outputRoot, "flows/TEST.1/result.json").rubric.expectedDecision
    ).toBe("deny")
    expect(
      readJson(outputRoot, "flows/TEST.1/navigator.json").steps[0].expectedValue
    ).toBe("70")

    const subjectData = readFileSync(
      join(outputRoot, "flows", "TEST.1", "data.json"),
      "utf8"
    )
    for (const key of [
      "expectedDecision",
      "expectedReasonCode",
      "expectedValue",
    ]) {
      expect(subjectData, `${key} must not reach subject data`).not.toContain(
        key
      )
    }
  })

  it("refuses a conversion whose subject data carries a loose answer key", async () => {
    await expect(
      run({
        flows: [
          conformingFlow("TEST.1", { data: data({ strayAnswerKey: true }) }),
        ],
      })
    ).rejects.toThrow(/answer key "correctValue"/)
  })

  it("permits the reserved mismatch block and records its path", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          data: data({ mismatchCorrectValue: "RICHARD" }),
          navigator: navigator({ expectedValue: "RICHARD" }),
        }),
      ],
    })

    expect(
      readJson(outputRoot, "flows/TEST.1/data.json").mismatch.fields[0]
        .correctValue
    ).toBe("RICHARD")
    expect(readReport(outputRoot)).toContain("mismatch.fields[N].correctValue")
  })
})

describe("governance (§45.3)", () => {
  it("strips the pass mark and records it as evidence instead", async () => {
    const { outputRoot } = await run({
      flows: [conformingFlow("TEST.1", { result: result({ passMark: 70 }) })],
    })

    const { rubric } = readJson(outputRoot, "flows/TEST.1/result.json")
    expect("passMark" in rubric).toBe(false)
    expect(readReport(outputRoot)).toContain("pass_standards")
  })

  it("keeps authored weights, which §45.1 assigns to the flow", async () => {
    const weights = { navigator: 140, decision: 20, reasonCode: 10 }
    const { outputRoot } = await run({
      flows: [conformingFlow("TEST.1", { result: result({ weights }) })],
    })
    expect(
      readJson(outputRoot, "flows/TEST.1/result.json").rubric.weights
    ).toEqual(weights)
  })

  it("ships the week mapping unassigned and marked not approved", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    const { moduleWeekMapping } = readJson(outputRoot, PACK_FILES.manifest)

    expect(moduleWeekMapping.approved).toBe(false)
    expect(moduleWeekMapping.approvalNote).toMatch(/not approved/)
    expect(moduleWeekMapping.weeks).toEqual({})
    expect(moduleWeekMapping.unassignedFlows).toEqual(["TEST.1"])
  })

  it("infers no week from a flow code", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("WK9.1")] })
    expect(
      readJson(outputRoot, PACK_FILES.manifest).moduleWeekMapping.weeks
    ).toEqual({})
  })
})

describe("vocabularies", () => {
  it("declares every decision key offered, including a distractor", async () => {
    // `pend` is never a correct answer, but a trainee can choose it and must be
    // scored wrong rather than refused.
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          ui: ui({
            decisionOptions: [
              { value: "pay", label: "Pay" },
              { value: "deny", label: "Deny" },
              { value: "pend", label: "Pend" },
            ],
          }),
        }),
      ],
    })

    const keys = readJson(outputRoot, PACK_FILES.manifest).decisionOptions.map(
      (option) => option.key
    )
    expect(keys).toEqual(["deny", "pay", "pend"])
  })

  it("unifies v1's catalog with the codes bundles author", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", { ui: ui({ rejectCodes: ["PX_AUTHORED"] }) }),
      ],
      catalogCodes: [["PX_CATALOG", "Only in the catalog"]],
    })

    const codes = readJson(outputRoot, PACK_FILES.manifest).reasonCodes.map(
      (entry) => entry.code
    )
    expect(codes).toContain("PX_CATALOG")
    expect(codes).toContain("PX_AUTHORED")
  })

  it("reports a code authored but missing from v1's catalog as drift", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", { ui: ui({ rejectCodes: ["PX_AUTHORED"] }) }),
      ],
      catalogCodes: [["PX_CATALOG", "Only in the catalog"]],
    })
    const report = readReport(outputRoot)
    expect(report).toContain("PX_AUTHORED")
    expect(report).toMatch(/missing from v1's catalog/)
  })

  it("gives every reason code a label, so none shows as a bare code", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", { ui: ui({ rejectCodes: ["PX_AUTHORED"] }) }),
      ],
    })
    for (const entry of readJson(outputRoot, PACK_FILES.manifest).reasonCodes) {
      expect(entry.label, `${entry.code} needs a label`).toBeTruthy()
    }
  })

  it("declares the PX edit bypass codes as their own vocabulary", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          ui: ui({ bypassCodes: ["PX_CB", "PX_DX"] }),
        }),
      ],
    })
    const codes = readJson(outputRoot, PACK_FILES.manifest).editBypassCodes.map(
      (entry) => entry.code
    )
    expect(codes).toEqual(["PX_CB", "PX_DX"])
  })
})

describe("subject index (§46)", () => {
  it("preserves each variant's subject refs", async () => {
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [{ name: "v2", subjectRefs: ["DCN-200002", "DCN-200003"] }],
        }),
      ],
    })

    const manifest = readJson(outputRoot, "flows/TEST.1/flow.json")
    expect(manifest.name).toBe("Fixture TEST.1")
    expect(manifest.variants).toHaveLength(2)
    expect(manifest.variants[0]).toMatchObject({
      variant: "base",
      variantIndex: 1,
      subjectRefs: ["DCN-100001"],
    })
    expect(manifest.variants[1].subjectRefs).toEqual([
      "DCN-200002",
      "DCN-200003",
    ])
  })

  it("resolves a flow name declared as a module constant", async () => {
    // 75 of the 92 flows use `flowName: FLOW_NAME`.
    const { outputRoot } = await run({
      flows: [
        conformingFlow("TEST.1", {
          flowName: "Constant named flow",
          nameStyle: "constant",
        }),
      ],
    })
    expect(readJson(outputRoot, "flows/TEST.1/flow.json").name).toBe(
      "Constant named flow"
    )
  })

  it("reports a ref claimed by two bundles without inventing a fix", async () => {
    // DCN-606105 in the real source: ZLL.1 and ZLS.1 both claim it. Both
    // fixtures here claim DCN-100001 for their base bundle.
    const { outputRoot, outcome } = await run({
      flows: [conformingFlow("ONE.1"), conformingFlow("TWO.1")],
    })

    expect(outcome.subjectRefCollisions).toHaveLength(1)
    expect(outcome.subjectRefCollisions[0].ref).toBe("DCN-100001")

    const report = readReport(outputRoot)
    expect(report).toContain("needing an authoring decision")
    expect(report).toContain("DCN-100001")

    // Both flows still convert: the defect is reported, not fatal.
    expect(existsSync(join(outputRoot, "flows", "ONE.1", "flow.json"))).toBe(
      true
    )
    expect(existsSync(join(outputRoot, "flows", "TWO.1", "flow.json"))).toBe(
      true
    )
  })

  it("reports no collision when every ref is unique", async () => {
    const { outcome, outputRoot } = await run({
      flows: [conformingFlow("ONE.1")],
    })
    expect(outcome.subjectRefCollisions).toHaveLength(0)
    expect(readReport(outputRoot)).toContain(
      "every subject ref routes to exactly one bundle"
    )
  })
})

describe("idempotence (task 7.4)", () => {
  it("produces byte-identical output on a second run", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const flows = [
      conformingFlow("TEST.1", {
        variants: [{ name: "v2", subjectRefs: ["DCN-200002"] }],
      }),
    ]

    const first = await run({ flows, outputRoot })
    const snapshot = readFileSync(
      join(outputRoot, "flows", "TEST.1", "ui.json"),
      "utf8"
    )

    const second = await convert({
      sourceRoot: first.sourceRoot,
      outputRoot,
      bespokeMapPath: first.bespokeMapPath,
      catalogPath: first.catalogPath,
      pins: null,
    })

    expect(second.filesWritten).toBe(0)
    expect(
      readFileSync(join(outputRoot, "flows", "TEST.1", "ui.json"), "utf8")
    ).toBe(snapshot)
  })

  it("prunes output whose source flow is gone", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const first = await run({
      flows: [conformingFlow("KEEP.1"), conformingFlow("GONE.1")],
      outputRoot,
    })

    expect(existsSync(join(outputRoot, "flows", "GONE.1", "ui.json"))).toBe(
      true
    )

    rmSync(join(first.sourceRoot, "GONE.1"), { recursive: true, force: true })

    const second = await convert({
      sourceRoot: first.sourceRoot,
      outputRoot,
      bespokeMapPath: first.bespokeMapPath,
      catalogPath: first.catalogPath,
      pins: null,
    })

    expect(second.orphansRemoved).toBeGreaterThan(0)
    expect(existsSync(join(outputRoot, "flows", "GONE.1"))).toBe(false)
    expect(existsSync(join(outputRoot, "flows", "KEEP.1", "ui.json"))).toBe(
      true
    )
  })

  it("embeds no timestamp or absolute source path in pack files", async () => {
    const { outputRoot, sourceRoot } = await run({
      flows: [conformingFlow("TEST.1")],
    })

    for (const relativePath of [
      "flows/TEST.1/ui.json",
      "flows/TEST.1/flow.json",
      PACK_FILES.manifest,
    ]) {
      const contents = readFileSync(
        join(outputRoot, ...relativePath.split("/")),
        "utf8"
      )
      expect(
        contents,
        `${relativePath} must not embed the source path`
      ).not.toContain(sourceRoot)
      expect(contents).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
    }
  })

  it("leaves the authored pack README alone", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    writeFileSync(join(outputRoot, "README.md"), "# claims pack\n")

    await run({ flows: [conformingFlow("TEST.1")], outputRoot })

    expect(readFileSync(join(outputRoot, "README.md"), "utf8")).toBe(
      "# claims pack\n"
    )
  })

  it("writes pack files in the repo's Prettier style", async () => {
    // `.prettierignore` leaves packs/ to Prettier, so output that is merely
    // tidy fails `pnpm format:check`.
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    const written = readFileSync(
      join(outputRoot, "flows", "TEST.1", "flow.json"),
      "utf8"
    )

    const { format } = await import("prettier")
    expect(written).toBe(await format(written, { parser: "json" }))
  })
})

describe("report (task 7.5)", () => {
  it("accounts for every dropped file", async () => {
    const { outputRoot, outcome } = await run({
      flows: [
        conformingFlow("TEST.1", {
          variants: [{ name: "v2", subjectRefs: ["DCN-200002"] }],
        }),
      ],
    })

    const report = readReport(outputRoot)
    expect(report).toContain("## Dropped files")
    // Four of the five variant files duplicate base.
    expect(outcome.drops).toBe(4)
    expect(report).toContain("drop-duplicate-variant-files")
  })

  it("records a rule that matched nothing rather than omitting it", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    const report = readReport(outputRoot)

    expect(report).toContain("assert-no-legacy-mode-key")
    expect(report).toMatch(/no-ops on this source/)
  })

  it("carries the governance evidence and the source path", async () => {
    const { outputRoot, sourceRoot } = await run({
      flows: [conformingFlow("TEST.1")],
    })
    const report = readReport(outputRoot)

    expect(report).toContain("## Governance evidence")
    expect(report).toContain("not approved")
    // The report may name the source path; pack content may not.
    expect(report).toContain(sourceRoot)
  })

  it("records the bespoke bindings it lifted", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    const report = readReport(outputRoot)

    expect(report).toContain("subtab_search_claims")
    expect(report).toContain("ClaimsSearchSubTab")
    expect(report).toContain("search.claims.results")
  })
})

describe("bespoke bindings", () => {
  it("writes the component onto the bound sub-tab", async () => {
    const { outputRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    const written = readJson(outputRoot, "flows/TEST.1/ui.json")
    expect(written.tabs[0].subTabs[0].component).toBe("ClaimsSearchSubTab")
  })

  it("refuses a binding no converted bundle declares", async () => {
    await expect(
      run({
        flows: [conformingFlow("TEST.1")],
        subTabId: "subtab_nothing_declares_this",
      })
    ).rejects.toThrow(/unreachable/)
  })
})

describe("source guards", () => {
  it("fails before writing when the source does not exist", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const { sourceRoot, v1Root } = parseArgs([
      join(outputRoot, "nope", "flows"),
      outputRoot,
    ])

    expect(() => assertSourceReadable({ sourceRoot, v1Root })).toThrow(
      /does not exist/
    )
    expect(existsSync(join(outputRoot, PACK_FILES.manifest))).toBe(false)
  })

  it("names the resolved path when the source is missing", () => {
    const { sourceRoot, v1Root } = parseArgs(["definitely/not/here"])
    expect(() => assertSourceReadable({ sourceRoot, v1Root })).toThrow(
      /definitely[\\/]not[\\/]here/
    )
  })

  it("requires a source path", () => {
    expect(() => parseArgs([])).toThrow(/Usage: pnpm packs:convert-v1/)
  })

  it("rejects an unknown option", () => {
    expect(() => parseArgs(["flows", "--nope"])).toThrow(/Unknown option/)
  })

  it("leaves the v1 source untouched", async () => {
    const { sourceRoot } = await run({ flows: [conformingFlow("TEST.1")] })
    expect(
      readFileSync(join(sourceRoot, "TEST.1", "ui.json"), "utf8")
    ).toContain("ui_test")
    expect(existsSync(join(sourceRoot, "TEST.1", "flow.json"))).toBe(false)
  })

  it("refuses a flow directory holding an unaccounted file", async () => {
    const repo = writeV1Repo({ flows: [conformingFlow("TEST.1")] })
    track(repo.v1Root)
    writeFileSync(join(repo.sourceRoot, "TEST.1", "notes.md"), "stray\n")

    await expect(
      convert({
        sourceRoot: repo.sourceRoot,
        outputRoot: track(makeTempDir("pack-")),
        bespokeMapPath: repo.bespokeMapPath,
        catalogPath: repo.catalogPath,
        pins: null,
      })
    ).rejects.toThrow(/notes\.md/)
  })
})

describe("self-verification (task 5.1)", () => {
  it("verifies by re-reading the files it wrote", async () => {
    const { outcome, outputRoot } = await run({
      flows: [conformingFlow("TEST.1")],
    })
    expect(outcome.verification.filesVerified).toBeGreaterThan(0)
    expect(outcome.verification.flowsVerified).toBe(1)
    expect(existsSync(join(outputRoot, PACK_FILES.report))).toBe(true)
  })

  it("fails when a mode key outside the enum reaches the output", async () => {
    await expect(
      run({
        flows: [
          conformingFlow("TEST.1", {
            state: state({ modeKeys: ["training", "sandbox"] }),
          }),
        ],
      })
    ).rejects.toThrow(/unknown mode key/)
  })
})
