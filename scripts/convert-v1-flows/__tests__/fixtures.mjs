/**
 * Fixture builders for the converter tests (task 7.1).
 *
 * Builds a v1-shaped flow tree on disk in a temp directory, because the
 * converter's contract is about files: reading a real tree, writing real files,
 * and re-reading them to verify. A mocked filesystem would test a different
 * program.
 *
 * Every fixture is minimal but structurally honest — the same five bundle
 * files, the same `index.ts` shape — so a test failure points at the rule under
 * test rather than at fixture drift.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export function makeTempDir(prefix = "convert-v1-") {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true })
}

/** A minimal `ui.json` with one tab, one sub-tab and one section. */
export function ui({
  id = "ui_test",
  name = "Test flow",
  subTabId = "subtab_search_claims",
  decisionOptions = [
    { value: "pay", label: "Pay" },
    { value: "deny", label: "Deny" },
  ],
  rejectCodes = null,
  visibleWhen = null,
  fieldVisibleWhen = null,
  bypassCodes = null,
} = {}) {
  const field = { id: "f_one", label: "One", type: "readonly_label" }
  if (fieldVisibleWhen) field.visibleWhen = fieldVisibleWhen

  const section = { id: "sec_one", title: "One", columns: 6, fields: [field] }
  if (visibleWhen) section.visibleWhen = visibleWhen

  const bypassField = bypassCodes
    ? {
        id: "f_er_bypass_code",
        label: "Bypass code",
        type: "select",
        options: bypassCodes.map((code) => ({ value: code, label: code })),
      }
    : null

  const document = {
    $schema: "training-platform/v1/flow-ui",
    id,
    name,
    description: "A fixture flow.",
    tabs: [
      {
        id: "tab_search",
        label: "Search",
        renderType: "sub_tabs",
        subTabs: [
          {
            id: subTabId,
            label: "Claims",
            sections: [
              section,
              ...(bypassField
                ? [
                    {
                      id: "sec_bypass",
                      title: "Bypass",
                      columns: 6,
                      fields: [bypassField],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    ],
    decisionConfig: {
      label: "Decision",
      placeholder: "Select decision",
      required: true,
      options: decisionOptions,
    },
  }

  if (rejectCodes) {
    document.denyConfig = {
      rejectCodes: rejectCodes.map((entry) =>
        typeof entry === "string"
          ? { code: entry, label: `Label for ${entry}` }
          : entry
      ),
    }
  }

  return document
}

/** A minimal `data.json`, optionally with a reserved mismatch block. */
export function data({
  subjectRef = "DCN-100001",
  mismatchCorrectValue = null,
  strayAnswerKey = false,
  extra = null,
} = {}) {
  const document = {
    $schema: "training-platform/v1/flow-data",
    claim: { dcn: subjectRef, status: "Pended" },
  }

  if (mismatchCorrectValue !== null) {
    document.mismatch = {
      fields: [
        {
          id: "mm_first",
          dataKey: "member.primary.first",
          displayedValue: "WRONG",
          correctValue: mismatchCorrectValue,
          sourceTabId: "tab_search",
          targetTabId: "tab_search",
        },
      ],
    }
  }

  // An answer key loose in subject data — the leak assertion 4.4 must catch.
  if (strayAnswerKey) document.claim.correctValue = "LEAKED"

  if (extra) Object.assign(document, extra)
  return document
}

/** A minimal `navigator.json`. */
export function navigator({
  expectedValue = null,
  subjectRef = null,
  targetFieldId = null,
  completesActionId = null,
  steps = null,
} = {}) {
  if (steps) {
    return {
      $schema: "training-platform/v1/flow-navigator",
      id: "nav_test",
      steps,
    }
  }

  const step = { id: "step_001", title: "Open claims", points: 10 }
  if (expectedValue !== null) step.expectedValue = expectedValue
  if (subjectRef) step.hint = `Review ${subjectRef} on the Search tab.`
  if (targetFieldId) step.targetFieldId = targetFieldId
  if (completesActionId) step.completesActionId = completesActionId

  return {
    $schema: "training-platform/v1/flow-navigator",
    id: "nav_test",
    steps: [step],
  }
}

/** A minimal `state.json`. */
export function state({
  modeKeys = ["training", "practice", "assessment"],
  actions = {},
} = {}) {
  const modeConfig = {}
  for (const key of modeKeys) modeConfig[key] = { id: key, label: key }

  return {
    $schema: "training-platform/v1/flow-state",
    id: "state_test",
    initial: { defaultDecision: "", decisionRequired: false },
    modeConfig,
    actions,
  }
}

/** A minimal `result.json`. */
export function result({
  expectedDecision = "pay",
  expectedReasonCode = "",
  passMark = 70,
  weights = { navigator: 100, decision: 20, reasonCode: 0 },
} = {}) {
  const rubric = {
    expectedDecision,
    expectedReasonCode,
    requiredStepIds: ["step_001"],
    weights,
    deductions: {
      perMissedRequiredStep: 0,
      wrongDecision: 20,
      wrongReasonCode: 0,
    },
  }
  if (passMark !== null) rubric.passMark = passMark

  return {
    $schema: "training-platform/v1/flow-result",
    id: "result_test",
    rubric,
    resultConfig: { passLabel: "Passed!", failLabel: "Not yet." },
  }
}

/**
 * Render a v1-shaped `index.ts`.
 *
 * `bindings` says, per variant, which files bind the variant's own copy — the
 * distinction lib/reachability.mjs reads and the reason dead content can be
 * told from live.
 */
export function indexTs({
  code,
  flowName,
  variants = [],
  nameStyle = "literal",
}) {
  const lines = []
  const safeName = code.replace(/[^A-Za-z0-9]/g, "")

  lines.push(`// Fixture bundle for ${code}.`)
  if (nameStyle === "constant") {
    lines.push(`const FLOW_NAME =`)
    lines.push(`  "${flowName}"`)
    lines.push("")
  }

  for (const file of ["ui", "data", "navigator", "state", "result"]) {
    lines.push(`import ${file} from "./${file}.json" with { type: "json" }`)
  }
  for (const variant of variants) {
    for (const [file, ownsCopy] of Object.entries(variant.bindings)) {
      if (!ownsCopy) continue
      const suffix = variant.name.slice(1)
      lines.push(
        `import ${file}${suffix} from "./${variant.name}/${file}.json" with { type: "json" }`
      )
    }
  }
  lines.push("")

  const nameExpression =
    nameStyle === "constant" ? "FLOW_NAME" : `"${flowName}"`

  lines.push(`export const flow${safeName}Bundle = {`)
  lines.push(`  flowSlug: "${code}",`)
  lines.push(`  flowName: ${nameExpression},`)
  lines.push(`  variantIndex: 1,`)
  lines.push(`  dcns: ["DCN-100001"],`)
  lines.push(`  ui,`)
  lines.push(`  data,`)
  lines.push(`  navigator,`)
  lines.push(`  state,`)
  lines.push(`  result,`)
  lines.push(`} as const`)
  lines.push("")

  for (const variant of variants) {
    const suffix = variant.name.slice(1)
    lines.push(`export const flow${safeName}V${suffix}Bundle = {`)
    lines.push(`  flowSlug: "${code}/${variant.name}",`)
    lines.push(`  flowName: flow${safeName}Bundle.flowName,`)
    lines.push(`  variantIndex: ${suffix},`)
    lines.push(
      `  dcns: [${(variant.subjectRefs ?? [`DCN-10000${suffix}`]).map((r) => `"${r}"`).join(", ")}],`
    )
    for (const file of ["ui", "data", "navigator", "state", "result"]) {
      lines.push(
        variant.bindings[file] ? `  ${file}: ${file}${suffix},` : `  ${file},`
      )
    }
    lines.push(`} as const`)
    lines.push("")
  }

  return lines.join("\n")
}

/** Write one flow directory into a v1-shaped source tree. */
export function writeFlow(sourceRoot, flow) {
  const flowDir = join(sourceRoot, flow.code)
  mkdirSync(flowDir, { recursive: true })

  for (const [file, contents] of Object.entries(flow.base)) {
    writeFileSync(join(flowDir, file), `${JSON.stringify(contents, null, 2)}\n`)
  }

  for (const variant of flow.variants ?? []) {
    const variantDir = join(flowDir, variant.name)
    mkdirSync(variantDir, { recursive: true })
    for (const [file, contents] of Object.entries(variant.files)) {
      writeFileSync(
        join(variantDir, file),
        `${JSON.stringify(contents, null, 2)}\n`
      )
    }
  }

  writeFileSync(
    join(flowDir, "index.ts"),
    indexTs({
      code: flow.code,
      flowName: flow.flowName ?? `Fixture ${flow.code}`,
      nameStyle: flow.nameStyle,
      variants: (flow.variants ?? []).map((variant) => ({
        name: variant.name,
        subjectRefs: variant.subjectRefs,
        bindings: variant.bindings,
      })),
    })
  )

  return flowDir
}

/**
 * A complete, conforming single-flow source tree.
 *
 * The base case every rule test varies from, so each test states only the one
 * thing it is about.
 */
export function writeMinimalSource({
  code = "TEST.1",
  variants = true,
  overrides = {},
} = {}) {
  const sourceRoot = makeTempDir()

  const base = {
    "ui.json": overrides.ui ?? ui(),
    "data.json": overrides.data ?? data(),
    "navigator.json": overrides.navigator ?? navigator(),
    "state.json": overrides.state ?? state(),
    "result.json": overrides.result ?? result(),
  }

  const variantList = variants
    ? [
        {
          name: "v2",
          subjectRefs: ["DCN-200002"],
          // Only data varies, as in 90 of v1's 92 flows.
          bindings: {
            ui: false,
            data: true,
            navigator: false,
            state: false,
            result: false,
          },
          files: {
            "ui.json": base["ui.json"],
            "data.json": data({ subjectRef: "DCN-200002" }),
            "navigator.json": base["navigator.json"],
            "state.json": base["state.json"],
            "result.json": base["result.json"],
          },
        },
      ]
    : []

  writeFlow(sourceRoot, {
    code,
    flowName: `Fixture ${code}`,
    nameStyle: overrides.nameStyle,
    base,
    variants: variantList,
  })

  return { sourceRoot, code }
}

/** A v1-shaped bespoke sub-tab map and the component it imports. */
export function writeBespokeMap(
  v1Root,
  { subTabId = "subtab_search_claims" } = {}
) {
  const workspaceDir = join(
    v1Root,
    "apps",
    "web",
    "src",
    "features",
    "training",
    "view",
    "workspace"
  )
  mkdirSync(join(workspaceDir, "claims-search"), { recursive: true })

  writeFileSync(
    join(workspaceDir, "claims-search", "ClaimsSearchSubTab.tsx"),
    [
      "/**",
      " * Fixture bespoke component. Reads the results from the flow bundle data",
      " * (`search.claims.results`).",
      " */",
      "export function ClaimsSearchSubTab() {",
      "  return null",
      "}",
      "",
    ].join("\n")
  )

  writeFileSync(
    join(workspaceDir, "customSubTabRenderers.tsx"),
    [
      'import { ClaimsSearchSubTab } from "./claims-search/ClaimsSearchSubTab"',
      "",
      "export const customSubTabRenderers: Record<string, unknown> = {",
      `  ${subTabId}: ClaimsSearchSubTab,`,
      "}",
      "",
    ].join("\n")
  )

  return join(workspaceDir, "customSubTabRenderers.tsx")
}

/** A v1-shaped reject-code catalog. */
export function writeRejectCodeCatalog(
  v1Root,
  codes = [["PX_R01030", "Coverage terminated"]]
) {
  const schemasDir = join(v1Root, "packages", "shared", "src", "schemas")
  mkdirSync(schemasDir, { recursive: true })

  const entries = codes
    .map(
      ([code, label]) =>
        `  {\n    code: "${code}",\n    label:\n      "${label}",\n  },`
    )
    .join("\n")

  const path = join(schemasDir, "reject-codes.ts")
  writeFileSync(
    path,
    [
      "export const REJECT_CODE_CATALOG = [",
      entries,
      "]",
      "",
      "export const MIN_REJECT_CODE_OPTIONS = 5",
      "",
    ].join("\n")
  )
  return path
}

/** A full v1-shaped repo: flows plus the two files outside the flows tree. */
export function writeV1Repo({ flows, catalogCodes, subTabId } = {}) {
  const v1Root = makeTempDir("v1-repo-")
  const sourceRoot = join(v1Root, "apps", "api", "src", "data", "flows")
  mkdirSync(sourceRoot, { recursive: true })

  for (const flow of flows ?? []) writeFlow(sourceRoot, flow)

  const bespokeMapPath = writeBespokeMap(v1Root, { subTabId })
  const catalogPath = writeRejectCodeCatalog(v1Root, catalogCodes)

  return { v1Root, sourceRoot, bespokeMapPath, catalogPath }
}

/** A conforming flow definition, for callers that want to vary one field. */
export function conformingFlow(code = "TEST.1", options = {}) {
  const baseUi = options.ui ?? ui()
  const baseNavigator = options.navigator ?? navigator()
  const baseState = options.state ?? state()
  const baseResult = options.result ?? result()
  const baseData = options.data ?? data()

  return {
    code,
    flowName: options.flowName ?? `Fixture ${code}`,
    nameStyle: options.nameStyle,
    base: {
      "ui.json": baseUi,
      "data.json": baseData,
      "navigator.json": baseNavigator,
      "state.json": baseState,
      "result.json": baseResult,
    },
    variants: (options.variants ?? []).map((variant) => ({
      name: variant.name,
      subjectRefs: variant.subjectRefs,
      bindings: {
        ui: false,
        data: true,
        navigator: false,
        state: false,
        result: false,
        ...variant.bindings,
      },
      files: {
        "ui.json": variant.ui ?? baseUi,
        "data.json":
          variant.data ?? data({ subjectRef: variant.subjectRefs?.[0] }),
        "navigator.json": variant.navigator ?? baseNavigator,
        "state.json": variant.state ?? baseState,
        "result.json": variant.result ?? baseResult,
      },
    })),
  }
}
