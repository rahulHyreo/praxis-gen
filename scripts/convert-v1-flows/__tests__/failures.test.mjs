/**
 * Failure paths.
 *
 * Every one of these is a case where the converter must refuse rather than
 * guess. That is the whole design: a conversion that silently guessed at what
 * v1 serves, or at a flow's name, or at a subject's routing, would produce a
 * pack that passes every other check and grades trainees wrongly. So the error
 * paths are the contract, not an afterthought, and each is tested for the
 * message a reader needs to diagnose it.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_OUTPUT_ROOT,
  assertSourceReadable,
  deriveV1Root,
  parseArgs,
} from "../lib/cli.mjs"
import {
  BUNDLE_FILES,
  SourceError,
  assertSourceInventory,
  listFlowCodes,
  readFlow,
  readJsonFile,
} from "../lib/source.mjs"
import {
  ReachabilityError,
  analyzeFlowReachability,
  assertKnownReachability,
  summarizeReachability,
} from "../lib/reachability.mjs"
import {
  FlowMetaError,
  buildFlowManifest,
  extractFlowMeta,
  findSubjectRefCollisions,
} from "../lib/flow-meta.mjs"
import {
  BespokeMapError,
  assertBindingsReachable,
  extractBespokeMap,
} from "../lib/bespoke.mjs"
import {
  VocabularyError,
  buildReasonCodeVocabulary,
  readRejectCodeCatalog,
} from "../lib/vocabulary.mjs"
import { VerificationError, verifyOutput } from "../lib/verify.mjs"
import {
  isDirectory,
  listExistingFiles,
  removeFileAndEmptyParents,
  serializeJson,
  writeFileIfChanged,
} from "../lib/write.mjs"
import { excerptPair } from "../lib/report.mjs"
import {
  cleanup,
  conformingFlow,
  makeTempDir,
  result,
  state,
  ui,
  writeFlow,
  writeRejectCodeCatalog,
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

describe("source reader", () => {
  it("names the directory it could not read", () => {
    expect(() => listFlowCodes(join(makeTempDir(), "missing"))).toThrow(
      SourceError
    )
  })

  it("names the file that is not valid JSON", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "broken.json")
    writeFileSync(path, "{ not json")
    expect(() => readJsonFile(path)).toThrow(/is not valid JSON/)
  })

  it("names the file it could not read", () => {
    expect(() => readJsonFile(join(makeTempDir(), "absent.json"))).toThrow(
      /Cannot read/
    )
  })

  it("skips dotted directories, which are tooling state and not flows", () => {
    const dir = track(makeTempDir())
    mkdirSync(join(dir, ".omc"), { recursive: true })
    mkdirSync(join(dir, "REAL.1"), { recursive: true })
    expect(listFlowCodes(dir)).toEqual(["REAL.1"])
  })

  it("names the missing bundle file rather than loading a partial flow", () => {
    const dir = track(makeTempDir())
    const flowDir = join(dir, "TEST.1")
    mkdirSync(flowDir, { recursive: true })
    // Everything but result.json.
    for (const file of BUNDLE_FILES.filter((f) => f !== "result.json")) {
      writeFileSync(join(flowDir, file), "{}\n")
    }
    expect(() => readFlow(dir, "TEST.1")).toThrow(/missing result\.json/)
  })

  it("reports both numbers when the inventory has moved", () => {
    // v1 gained or lost content; the right response is to review, not to edit
    // the expectation until it passes.
    expect(() =>
      assertSourceInventory({
        flowCount: 91,
        variantDirCount: 360,
        expected: { flowCount: 92, variantDirCount: 364 },
      })
    ).toThrow(/expected 92 flow groups, found 91/)
  })

  it("passes when the inventory matches", () => {
    expect(() =>
      assertSourceInventory({
        flowCount: 2,
        variantDirCount: 1,
        expected: { flowCount: 2, variantDirCount: 1 },
      })
    ).not.toThrow()
  })
})

describe("reachability analysis", () => {
  const flow = (indexSource, variants = [{ name: "v2" }]) => ({
    code: "TEST.1",
    indexSource,
    variants,
  })

  it("refuses a flow with no index.ts rather than guessing", () => {
    expect(() => analyzeFlowReachability(flow(null))).toThrow(/no index\.ts/)
  })

  it("refuses a variant directory the module never declares", () => {
    expect(() =>
      analyzeFlowReachability(flow('export const x = { flowSlug: "TEST.1" }'))
    ).toThrow(/declares no bundle with flowSlug "TEST.1\/v2"/)
  })

  it("refuses a binding it cannot resolve to an imported file", () => {
    const indexSource = [
      'import ui from "./ui.json" with { type: "json" }',
      "export const a = {",
      '  flowSlug: "TEST.1/v2",',
      "  ui: somethingUnknown,",
      "} as const",
    ].join("\n")
    expect(() => analyzeFlowReachability(flow(indexSource))).toThrow(
      /cannot resolve which ui\.json v1 serves/
    )
  })

  it("reports which flows diverge from the pinned expectation", () => {
    expect(() =>
      assertKnownReachability(
        { "OTHER.1": { v2: { "navigator.json": true } } },
        { "navigator.json": ["507.3"] }
      )
    ).toThrow(/found \[OTHER\.1\]/)
  })

  it("summarizes without asserting when nothing is pinned", () => {
    const { liveFlowsByFile } = summarizeReachability({
      "A.1": { v2: { "data.json": true, "ui.json": false } },
    })
    expect(liveFlowsByFile["data.json"]).toEqual(["A.1"])
    expect(liveFlowsByFile["ui.json"]).toEqual([])
  })

  it("is an error type callers can distinguish", () => {
    expect(() => analyzeFlowReachability(flow(null))).toThrow(ReachabilityError)
  })
})

describe("flow metadata", () => {
  const meta = (indexSource, variants = []) =>
    extractFlowMeta({ code: "TEST.1", indexSource, variants })

  it("refuses a flow with no index.ts", () => {
    expect(() => meta(null)).toThrow(/flow name and subject index/)
  })

  it("refuses a module declaring no base bundle", () => {
    expect(() => meta("const nothing = 1")).toThrow(
      /declares no bundle with flowSlug/
    )
  })

  it("refuses a flowName constant it cannot resolve", () => {
    const indexSource = [
      "export const a = {",
      '  flowSlug: "TEST.1",',
      "  flowName: MISSING_NAME,",
      '  dcns: ["DCN-1"],',
      "} as const",
    ].join("\n")
    expect(() => meta(indexSource)).toThrow(/no string constant of that name/)
  })

  it("refuses a bundle with no dcns array, which is the subject index", () => {
    const indexSource = [
      "export const a = {",
      '  flowSlug: "TEST.1",',
      '  flowName: "A flow",',
      "} as const",
    ].join("\n")
    expect(() => meta(indexSource)).toThrow(/declares no dcns array/)
  })

  it("refuses an empty dcns array", () => {
    const indexSource = [
      "export const a = {",
      '  flowSlug: "TEST.1",',
      '  flowName: "A flow",',
      "  dcns: [],",
      "} as const",
    ].join("\n")
    expect(() => meta(indexSource)).toThrow(/is empty/)
  })

  it("refuses a variant on disk the module does not declare", () => {
    const indexSource = [
      "export const a = {",
      '  flowSlug: "TEST.1",',
      '  flowName: "A flow",',
      '  dcns: ["DCN-1"],',
      "} as const",
    ].join("\n")
    expect(() => meta(indexSource, [{ name: "v2" }])).toThrow(
      /declares no bundle with flowSlug "TEST\.1\/v2"/
    )
  })

  it("is an error type callers can distinguish", () => {
    expect(() => meta(null)).toThrow(FlowMetaError)
  })

  it("lists the base before its variants in the written manifest", () => {
    const manifest = buildFlowManifest({
      code: "TEST.1",
      meta: {
        flowName: "A flow",
        base: { variantIndex: 1, subjectRefs: ["DCN-1"] },
        variants: { v2: { variantIndex: 2, subjectRefs: ["DCN-2"] } },
      },
    })
    expect(manifest.variants.map((v) => v.variant)).toEqual(["base", "v2"])
  })

  it("names both claimants of a colliding subject ref", () => {
    const { uniqueRefs, collisions } = findSubjectRefCollisions([
      { ref: "DCN-1", owner: "A/base" },
      { ref: "DCN-1", owner: "B/base" },
      { ref: "DCN-2", owner: "A/base" },
    ])
    expect(uniqueRefs).toBe(2)
    expect(collisions).toEqual([
      { ref: "DCN-1", first: "A/base", second: "B/base" },
    ])
  })
})

describe("bespoke map", () => {
  it("names the map it could not read", () => {
    expect(() => extractBespokeMap(join(makeTempDir(), "absent.tsx"))).toThrow(
      /Cannot read v1's bespoke sub-tab map/
    )
  })

  it("refuses a map it parsed no bindings from", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "customSubTabRenderers.tsx")
    writeFileSync(path, "export const customSubTabRenderers = {}\n")
    expect(() => extractBespokeMap(path)).toThrow(/Parsed no sub-tab bindings/)
  })

  it("refuses a binding whose component is not imported", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "customSubTabRenderers.tsx")
    writeFileSync(
      path,
      "export const customSubTabRenderers = {\n  subtab_a: NotImported,\n}\n"
    )
    expect(() => extractBespokeMap(path)).toThrow(/is not\s+imported/)
  })

  it("refuses a component whose source file is missing", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "customSubTabRenderers.tsx")
    writeFileSync(
      path,
      [
        'import { Gone } from "./gone/Gone"',
        "export const customSubTabRenderers = {",
        "  subtab_a: Gone,",
        "}",
      ].join("\n")
    )
    expect(() => extractBespokeMap(path)).toThrow(/Cannot find the source/)
  })

  it("names an unreachable binding", () => {
    expect(() =>
      assertBindingsReachable(
        { subtab_missing: { component: "X" } },
        new Set(["subtab_present"])
      )
    ).toThrow(/subtab_missing/)
  })

  it("accepts bindings that every sub-tab declares", () => {
    expect(() =>
      assertBindingsReachable(
        { subtab_present: { component: "X" } },
        new Set(["subtab_present"])
      )
    ).not.toThrow()
  })

  it("is an error type callers can distinguish", () => {
    expect(() => extractBespokeMap("nope.tsx")).toThrow(BespokeMapError)
  })
})

describe("vocabulary", () => {
  it("names the catalog it could not read", () => {
    expect(() => readRejectCodeCatalog(join(makeTempDir(), "x.ts"))).toThrow(
      /Cannot read v1's reject-code catalog/
    )
  })

  it("refuses a catalog it parsed no codes from", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "reject-codes.ts")
    writeFileSync(path, "export const REJECT_CODE_CATALOG = []\n")
    expect(() => readRejectCodeCatalog(path)).toThrow(/Parsed no codes/)
  })

  it("reads a catalog whose labels wrap across lines", () => {
    const dir = track(makeTempDir())
    const path = writeRejectCodeCatalog(dir, [
      ["PX_A", "A label long enough to wrap in the source file"],
    ])
    const catalog = readRejectCodeCatalog(path)
    expect(catalog.get("PX_A")).toBe(
      "A label long enough to wrap in the source file"
    )
  })

  it("refuses an expectation absent from both the catalog and every picker", () => {
    expect(() =>
      buildReasonCodeVocabulary({
        catalog: new Map([["PX_A", "A"]]),
        authored: new Map(),
        expected: new Set(["PX_GHOST"]),
      })
    ).toThrow(/PX_GHOST/)
  })

  it("reports drift in both directions", () => {
    const { vocabulary, drift } = buildReasonCodeVocabulary({
      catalog: new Map([["PX_ONLY_CATALOG", "C"]]),
      authored: new Map([["PX_ONLY_AUTHORED", "A"]]),
      expected: new Set(),
    })
    expect(vocabulary.size).toBe(2)
    expect(drift.authoredNotInCatalog).toEqual(["PX_ONLY_AUTHORED"])
    expect(drift.catalogNeverAuthored).toEqual(["PX_ONLY_CATALOG"])
  })

  it("reports a code that would be shown as a bare code", () => {
    const { drift } = buildReasonCodeVocabulary({
      catalog: new Map(),
      authored: new Map([["PX_NO_LABEL", ""]]),
      expected: new Set(),
    })
    expect(drift.missingLabels).toEqual(["PX_NO_LABEL"])
  })

  it("is an error type callers can distinguish", () => {
    expect(() => readRejectCodeCatalog("nope.ts")).toThrow(VocabularyError)
  })
})

describe("output verification", () => {
  const verify = (outputRoot, expectedPaths, vocabulary = new Set()) =>
    verifyOutput({
      outputRoot,
      expectedPaths,
      reasonCodeVocabulary: vocabulary,
    })

  const writePack = async (outputRoot, code, files) => {
    for (const [relative, value] of Object.entries(files)) {
      await writeFileIfChanged(
        join(outputRoot, "flows", code, ...relative.split("/")),
        await serializeJson(value)
      )
    }
  }

  // Post-transform shape: the pass mark stripped and the empty-string answers
  // already nulled, which is what the verifier expects to find on disk.
  const converted = (overrides = {}) =>
    result({ passMark: null, expectedReasonCode: null, ...overrides })

  const fullFlow = (overrides = {}) => ({
    "ui.json": ui(),
    "data.json": { claim: { dcn: "DCN-1" } },
    "navigator.json": { steps: [] },
    "state.json": state(),
    "result.json": converted(),
    "flow.json": {
      code: "TEST.1",
      name: "A flow",
      variants: [{ variant: "base", variantIndex: 1, subjectRefs: ["DCN-1"] }],
    },
    ...overrides,
  })

  const paths = (code, files) =>
    Object.keys(files).map((relative) => `flows/${code}/${relative}`)

  it("names an expected file that never reached disk", () => {
    const outputRoot = track(makeTempDir("pack-"))
    expect(() => verify(outputRoot, ["flows/TEST.1/ui.json"])).toThrow(
      /expected output is missing from disk/
    )
  })

  it("names a file that does not parse", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    mkdirSync(join(outputRoot, "flows", "TEST.1"), { recursive: true })
    writeFileSync(join(outputRoot, "flows", "TEST.1", "ui.json"), "{ broken")
    expect(() => verify(outputRoot, ["flows/TEST.1/ui.json"])).toThrow(
      /does not parse as JSON/
    )
  })

  it("accepts a conforming flow", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow()
    await writePack(outputRoot, "TEST.1", files)
    const outcome = verify(outputRoot, paths("TEST.1", files))
    expect(outcome.flowsVerified).toBe(1)
  })

  it("names a flow missing a bundle file", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow()
    delete files["result.json"]
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /missing result\.json/
    )
  })

  it("names a flow missing its subject index", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow()
    delete files["flow.json"]
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /must carry its name and subject index/
    )
  })

  it("names a variant file that duplicates its base", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow()
    files["v2/data.json"] = files["data.json"]
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /identical to its base after normalization/
    )
  })

  it("names a variant folder with no data.json", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow()
    files["v2/navigator.json"] = { steps: [{ id: "step_x" }] }
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /has no data\.json/
    )
  })

  it("names a rubric that still carries a pass mark", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow({ "result.json": converted({ passMark: 70 }) })
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /still carries rubric\.passMark/
    )
  })

  it("names an empty-string decision that should be null", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow({
      "result.json": converted({ expectedDecision: "" }),
    })
    await writePack(outputRoot, "TEST.1", files)
    expect(() => verify(outputRoot, paths("TEST.1", files))).toThrow(
      /is "" — a no-decision answer is null/
    )
  })

  it("names a reason code absent from the vocabulary", async () => {
    const outputRoot = track(makeTempDir("pack-"))
    const files = fullFlow({
      "result.json": converted({ expectedReasonCode: "PX_GHOST" }),
    })
    await writePack(outputRoot, "TEST.1", files)
    expect(() =>
      verify(outputRoot, paths("TEST.1", files), new Set(["PX_REAL"]))
    ).toThrow(/absent from the pack\s+vocabulary/)
  })

  it("is an error type callers can distinguish", () => {
    const outputRoot = track(makeTempDir("pack-"))
    expect(() => verify(outputRoot, ["flows/TEST.1/ui.json"])).toThrow(
      VerificationError
    )
  })
})

describe("writer", () => {
  it("reports an unchanged file as not written, keeping mtimes stable", async () => {
    const dir = track(makeTempDir())
    const path = join(dir, "a.json")
    expect((await writeFileIfChanged(path, "x")).written).toBe(true)
    expect((await writeFileIfChanged(path, "x")).written).toBe(false)
  })

  it("lists nothing for a root that does not exist", () => {
    expect(listExistingFiles(join(makeTempDir(), "absent"))).toEqual([])
  })

  it("lists files with forward slashes, whatever the platform", () => {
    const dir = track(makeTempDir())
    mkdirSync(join(dir, "flows", "A.1"), { recursive: true })
    writeFileSync(join(dir, "flows", "A.1", "ui.json"), "{}")
    expect(listExistingFiles(dir)).toEqual(["flows/A.1/ui.json"])
  })

  it("removes the directories a pruned file leaves empty", () => {
    const dir = track(makeTempDir())
    mkdirSync(join(dir, "flows", "A.1", "v2"), { recursive: true })
    writeFileSync(join(dir, "flows", "A.1", "v2", "data.json"), "{}")

    removeFileAndEmptyParents(dir, "flows/A.1/v2/data.json")

    // Otherwise an empty flows/A.1/ reads as a flow with no content.
    expect(isDirectory(join(dir, "flows", "A.1"))).toBe(false)
  })

  it("keeps a directory that still holds something", () => {
    const dir = track(makeTempDir())
    mkdirSync(join(dir, "flows", "A.1"), { recursive: true })
    writeFileSync(join(dir, "flows", "A.1", "ui.json"), "{}")
    writeFileSync(join(dir, "flows", "A.1", "data.json"), "{}")

    removeFileAndEmptyParents(dir, "flows/A.1/ui.json")

    expect(isDirectory(join(dir, "flows", "A.1"))).toBe(true)
  })

  it("tolerates removing a file that is already gone", () => {
    const dir = track(makeTempDir())
    expect(() =>
      removeFileAndEmptyParents(dir, "flows/A.1/ui.json")
    ).not.toThrow()
  })

  it("reports a missing path as not a directory", () => {
    expect(isDirectory(join(makeTempDir(), "absent"))).toBe(false)
  })
})

describe("argument parsing", () => {
  it("defaults the output to the claims pack", () => {
    const { outputRoot } = parseArgs(["flows"], { cwd: "/repo" })
    expect(outputRoot.replace(/\\/g, "/")).toContain(DEFAULT_OUTPUT_ROOT)
  })

  it("accepts the output as a positional argument", () => {
    const { outputRoot } = parseArgs(["flows", "out"], { cwd: "/repo" })
    expect(outputRoot.replace(/\\/g, "/")).toContain("/repo/out")
  })

  it("accepts --out and --v1-root in both forms", () => {
    const spaced = parseArgs(["flows", "--out", "o", "--v1-root", "r"], {
      cwd: "/repo",
    })
    const joined = parseArgs(["flows", "--out=o", "--v1-root=r"], {
      cwd: "/repo",
    })
    expect(spaced.outputRoot).toBe(joined.outputRoot)
    expect(spaced.v1Root).toBe(joined.v1Root)
  })

  it("derives the v1 root from the flows path", () => {
    // Compared against `resolve` of the same root, because on Windows a rooted
    // POSIX path gains a drive letter and a literal "/repo" would never match.
    expect(
      deriveV1Root(join("/repo", "apps", "api", "src", "data", "flows"))
    ).toBe(resolve("/repo"))
  })

  it("rejects a source path that is a file, not a directory", () => {
    const dir = track(makeTempDir())
    const path = join(dir, "flows")
    writeFileSync(path, "not a directory")
    expect(() =>
      assertSourceReadable({ sourceRoot: path, v1Root: dir })
    ).toThrow(/is not a directory/)
  })

  it("explains how to point at the bespoke map when it is missing", () => {
    const repo = writeV1Repo({ flows: [conformingFlow("TEST.1")] })
    track(repo.v1Root)
    rmSync(repo.bespokeMapPath)

    expect(() =>
      assertSourceReadable({
        sourceRoot: repo.sourceRoot,
        v1Root: repo.v1Root,
      })
    ).toThrow(/Pass --v1-root/)
  })

  it("accepts a readable source", () => {
    const repo = writeV1Repo({ flows: [conformingFlow("TEST.1")] })
    track(repo.v1Root)
    const { bespokeMapPath } = assertSourceReadable({
      sourceRoot: repo.sourceRoot,
      v1Root: repo.v1Root,
    })
    expect(bespokeMapPath).toBe(repo.bespokeMapPath)
  })
})

describe("report excerpts", () => {
  it("returns short values whole", () => {
    expect(excerptPair("a", "b")).toEqual(['"a"', '"b"'])
  })

  it("centres the window on the difference, not the start", () => {
    // Truncating two long strings from the left shows two identical prefixes,
    // which is exactly wrong for a table about what changed.
    const shared = "x".repeat(120)
    const [left, right] = excerptPair(`${shared}RICHARD`, `${shared}RAUL`)
    expect(left).toContain("RICHARD")
    expect(right).toContain("RAUL")
    expect(left.startsWith("…")).toBe(true)
  })

  it("handles an added value with no counterpart", () => {
    const [left, right] = excerptPair(undefined, "y".repeat(200))
    expect(left).toBe("undefined")
    expect(right).toContain("y")
  })
})

describe("flow fixtures round-trip", () => {
  it("reads back a written fixture flow", () => {
    const dir = track(makeTempDir())
    writeFlow(dir, conformingFlow("TEST.1", { variants: [{ name: "v2" }] }))

    const flow = readFlow(dir, "TEST.1")
    expect(flow.code).toBe("TEST.1")
    expect(flow.variants.map((v) => v.name)).toEqual(["v2"])
    expect(flow.unknownFiles).toEqual([])
    expect(flow.indexSource).toContain('flowSlug: "TEST.1"')
  })
})
