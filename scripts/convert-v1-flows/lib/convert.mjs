/**
 * The conversion pipeline.
 *
 * Processes ONE FLOW AT A TIME and releases it. The source is 111.7 MB and
 * `ui.json` is 89 MB of that, so holding all 456 bundles in memory would cost
 * an order of magnitude more than the work needs. Only small report metadata
 * accumulates across flows.
 *
 * Order matters: everything checkable about the source is checked before the
 * output is touched, so a failing run cannot leave a pack that is neither the
 * old content nor the new.
 */

import { join } from "node:path"

import {
  BUNDLE_FILES,
  EXPECTED_FLOW_COUNT,
  EXPECTED_VARIANT_DIR_COUNT,
  assertSourceInventory,
  listFlowCodes,
  readFlow,
} from "./source.mjs"
import {
  EXPECTED_LIVE_VARIANT_FILES,
  analyzeFlowReachability,
  assertKnownReachability,
  summarizeReachability,
} from "./reachability.mjs"
import {
  assertAnswerKeysConfined,
  assertNoFieldLevelVisibleWhen,
  assertNoLegacyModeKey,
  assertNoUnknownSourceFiles,
  assertReasonCodesResolve,
  assertVariantGradedValues,
} from "./assertions.mjs"
import {
  declareBespokeComponents,
  decideVariantFile,
  nullDecision,
  planOrphanRemovals,
  stripPassMark,
} from "./rules.mjs"
import {
  buildReasonCodeVocabulary,
  collectAuthoredReasonCodes,
  collectBypassCodes,
  collectDecisionOptions,
  readRejectCodeCatalog,
} from "./vocabulary.mjs"
import { assertBindingsReachable, extractBespokeMap } from "./bespoke.mjs"
import { diffPaths } from "./normalize.mjs"
import {
  buildFlowManifest,
  extractFlowMeta,
  findSubjectRefCollisions,
} from "./flow-meta.mjs"
import { buildGlossary, buildPackManifest, PACK_FILES } from "./manifest.mjs"
import { renderReport } from "./report.mjs"
import { verifyOutput } from "./verify.mjs"
import {
  listExistingFiles,
  removeFileAndEmptyParents,
  resolvePrettierConfig,
  serializeJson,
  serializeMarkdown,
  writeFileIfChanged,
  writeJsonFile,
} from "./write.mjs"

const bump = (counts, rule, by = 1) => {
  counts[rule] = (counts[rule] ?? 0) + by
}

/**
 * Facts pinned about the v1 tree this converter was written against.
 *
 * Checking these is how a change in v1's content fails the run instead of
 * passing unnoticed. They describe one specific source, though, so a caller
 * converting a different tree — a test fixture, or a future second pack —
 * passes `pins: null` to skip them rather than editing the expected values
 * until they pass.
 */
export const V1_PINS = {
  inventory: {
    flowCount: EXPECTED_FLOW_COUNT,
    variantDirCount: EXPECTED_VARIANT_DIR_COUNT,
  },
  liveVariantFiles: EXPECTED_LIVE_VARIANT_FILES,
}

/**
 * Convert a v1 flows tree into pack content.
 *
 * Returns the facts the report renders. Writing is done here rather than
 * returned as a plan, because the verification step must read what actually
 * landed on disk.
 */
export async function convert({
  sourceRoot,
  outputRoot,
  bespokeMapPath,
  catalogPath,
  pins = V1_PINS,
}) {
  /* -------------------------------------------------- pass 1: source + checks */

  const codes = listFlowCodes(sourceRoot)
  const bespokeMap = extractBespokeMap(bespokeMapPath)
  const catalog = readRejectCodeCatalog(catalogPath)

  // Resolved once and reused: the pack must be written exactly as the repo's
  // Prettier would, because `.prettierignore` leaves `packs/` to Prettier and
  // `pnpm format:check` is part of the gate.
  const formatting = {
    prettierConfig: await resolvePrettierConfig(),
  }

  const ruleCounts = {}
  const drops = []
  const divergences = []
  const transforms = []
  const passMarks = []
  const reservedAnswerKeyPaths = []
  const declaredSubTabIds = new Set()
  const reachabilityByFlow = {}

  const authoredReasonCodes = new Map()
  const bypassCodes = new Map()
  const decisionOptions = new Map()
  const expectedReasonCodes = new Set()
  const subjectRefClaims = []

  const sizes = {
    source: 0,
    written: 0,
    byFile: Object.fromEntries(
      BUNDLE_FILES.map((file) => [file, { written: 0, dropped: 0 }])
    ),
  }

  let variantDirectoryCount = 0
  let bundleCount = 0

  // Planned writes, kept as serialized strings so the second pass does not
  // re-hold every parsed bundle.
  const plannedFiles = []

  for (const code of codes) {
    const flow = readFlow(sourceRoot, code)
    variantDirectoryCount += flow.variants.length
    bundleCount += 1 + flow.variants.length

    assertNoUnknownSourceFiles(flow)
    bump(ruleCounts, "assert-unknown-source-files")

    const reachability = analyzeFlowReachability(flow)
    reachabilityByFlow[code] = reachability

    // Vocabulary and inventory come from the base bundle: ui.json is identical
    // across every live variant, and data refs are collected per bundle below.
    const baseUi = flow.base["ui.json"].json
    collectAuthoredReasonCodes(baseUi, authoredReasonCodes)
    collectBypassCodes(baseUi, bypassCodes)
    collectDecisionOptions(baseUi, decisionOptions)

    const baseResult = flow.base["result.json"].json
    const expectedReasonCode = baseResult?.rubric?.expectedReasonCode
    if (typeof expectedReasonCode === "string" && expectedReasonCode !== "") {
      expectedReasonCodes.add(expectedReasonCode)
    }

    /* ---------------------------------------- decide what each variant carries */

    const carriedVariantFiles = new Map() // `${variant}/${file}` -> json

    for (const variant of flow.variants) {
      for (const file of BUNDLE_FILES) {
        const present = variant.files[file]
        if (!present) continue

        sizes.source += Buffer.byteLength(present.raw, "utf8")

        const decision = decideVariantFile({
          variantJson: present.json,
          baseJson: flow.base[file].json,
          isLive: reachability[variant.name][file],
        })

        if (decision.carry && file !== "data.json") {
          // Record WHAT diverges in a carried non-data file. These are the 12
          // files the §13 departure (D3) turns on, so the report shows the
          // graded value rather than asking a reviewer to take it on trust.
          // data.json is excluded: it differs in all 364 variants by design,
          // and listing every field would bury the interesting cases.
          divergences.push({
            path: `flows/${code}/${variant.name}/${file}`,
            diffs: diffPaths(flow.base[file].json, present.json),
          })
        }

        if (!decision.carry) {
          bump(ruleCounts, decision.rule)
          drops.push({
            path: `flows/${code}/${variant.name}/${file}`,
            rule: decision.rule,
            reason: decision.reason,
          })
          sizes.byFile[file].dropped += Buffer.byteLength(present.raw, "utf8")
          continue
        }

        carriedVariantFiles.set(`${variant.name}/${file}`, present.json)
      }
    }

    for (const file of BUNDLE_FILES) {
      sizes.source += Buffer.byteLength(flow.base[file].raw, "utf8")
    }

    /* ------------------------------------- assertions on the served bundles */

    const servedBundle = (variantName) => {
      const files = {}
      for (const file of BUNDLE_FILES) {
        files[file] = variantName
          ? (carriedVariantFiles.get(`${variantName}/${file}`) ??
            flow.base[file].json)
          : flow.base[file].json
      }
      return files
    }

    const variantNames = [null, ...flow.variants.map((v) => v.name)]

    for (const variantName of variantNames) {
      const served = servedBundle(variantName)
      const label = `${code}${variantName ? `/${variantName}` : ""}`

      const visibleWhen = assertNoFieldLevelVisibleWhen(
        served["ui.json"],
        label
      )
      bump(
        ruleCounts,
        "assert-no-field-level-visible-when",
        visibleWhen.sectionLevel
      )

      assertNoLegacyModeKey(served["state.json"], label)
      // Honest count: the legacy key does not exist in this source.
      bump(ruleCounts, "assert-no-legacy-mode-key", 0)

      const graded = assertVariantGradedValues({
        code,
        variantName,
        navigatorJson: served["navigator.json"],
        dataJson: served["data.json"],
        uiJson: served["ui.json"],
        stateJson: served["state.json"],
      })
      bump(
        ruleCounts,
        "assert-variant-graded-values",
        graded.checkedRefs + graded.checkedTargets + graded.checkedMismatches
      )

      const answerKeys = assertAnswerKeysConfined(served["data.json"], label)
      bump(ruleCounts, "assert-answer-keys-confined")
      reservedAnswerKeyPaths.push(...answerKeys.reservedPaths)
    }

    /* ---------------------------------- flow metadata and the subject index */

    const meta = extractFlowMeta(flow)
    bump(ruleCounts, "extract-subject-index")

    for (const ref of meta.base.subjectRefs) {
      subjectRefClaims.push({ ref, owner: `${code}/base` })
    }
    for (const [variantName, variant] of Object.entries(meta.variants)) {
      for (const ref of variant.subjectRefs) {
        subjectRefClaims.push({ ref, owner: `${code}/${variantName}` })
      }
    }

    plannedFiles.push({
      path: `flows/${code}/flow.json`,
      contents: await serializeJson(
        buildFlowManifest({ code, meta }),
        formatting
      ),
    })

    /* ----------------------------------------------------------- transforms */

    const transformFile = (file, json, relativePath) => {
      let next = json

      if (file === "result.json") {
        const nulled = nullDecision(next)
        next = nulled.json
        for (const entry of nulled.transforms) {
          bump(ruleCounts, "null-decision")
          transforms.push({ ...entry, file: relativePath })
        }

        const stripped = stripPassMark(next)
        next = stripped.json
        if (stripped.passMark !== undefined) {
          bump(ruleCounts, "strip-pass-mark")
          passMarks.push({ code, passMark: stripped.passMark })
          for (const entry of stripped.transforms) {
            transforms.push({ ...entry, file: relativePath })
          }
        }
      }

      if (file === "ui.json") {
        const declared = declareBespokeComponents(next, bespokeMap.bindings)
        next = declared.json
        for (const id of declared.declaredSubTabIds) declaredSubTabIds.add(id)
        for (const entry of declared.declarations) {
          bump(ruleCounts, "declare-bespoke-components")
          transforms.push({
            rule: entry.rule,
            file: relativePath,
            path: `subTab ${entry.subTabId}.component`,
            from: undefined,
            to: entry.component,
          })
        }
      }

      return next
    }

    for (const file of BUNDLE_FILES) {
      const relativePath = `flows/${code}/${file}`
      const json = transformFile(file, flow.base[file].json, relativePath)
      const contents = await serializeJson(json, formatting)
      plannedFiles.push({ path: relativePath, contents })
      sizes.written += Buffer.byteLength(contents, "utf8")
      sizes.byFile[file].written += Buffer.byteLength(contents, "utf8")
    }

    for (const [key, json] of carriedVariantFiles) {
      const [variantName, file] = key.split("/")
      const relativePath = `flows/${code}/${variantName}/${file}`
      const transformed = transformFile(file, json, relativePath)
      const contents = await serializeJson(transformed, formatting)
      plannedFiles.push({ path: relativePath, contents })
      sizes.written += Buffer.byteLength(contents, "utf8")
      sizes.byFile[file].written += Buffer.byteLength(contents, "utf8")
    }
  }

  /* ---------------------------------------------- cross-flow source checks */

  if (pins?.inventory) {
    assertSourceInventory({
      flowCount: codes.length,
      variantDirCount: variantDirectoryCount,
      expected: pins.inventory,
    })
  }

  const { liveFlowsByFile } = pins?.liveVariantFiles
    ? assertKnownReachability(reachabilityByFlow, pins.liveVariantFiles)
    : summarizeReachability(reachabilityByFlow)
  assertBindingsReachable(bespokeMap.bindings, declaredSubTabIds)

  // A subject should route to exactly one bundle. A collision is reported
  // rather than fatal: it is a pre-existing v1 authoring slip whose fix is an
  // authoring decision, not something this conversion may invent.
  const { uniqueRefs, collisions: subjectRefCollisions } =
    findSubjectRefCollisions(subjectRefClaims)

  const { vocabulary: reasonCodeVocabulary, drift } = buildReasonCodeVocabulary(
    {
      catalog,
      authored: authoredReasonCodes,
      expected: expectedReasonCodes,
    }
  )

  /* ------------------------------------------------------------- manifest */

  const manifest = buildPackManifest({
    decisionOptions,
    reasonCodes: reasonCodeVocabulary,
    bypassCodes,
    flowCodes: codes,
  })

  plannedFiles.push({
    path: PACK_FILES.manifest,
    contents: await serializeJson(manifest, formatting),
  })

  plannedFiles.push({
    path: PACK_FILES.glossary,
    contents: buildGlossary({
      reasonCodeCount: reasonCodeVocabulary.size,
      bypassCodeCount: bypassCodes.size,
    }),
  })

  /* ----------------------------------------------------------------- write */

  const expectedPaths = plannedFiles.map((file) => file.path).sort()
  // Only paths this converter owns are candidates for pruning. The pack's
  // README is authored by hand and must survive a re-run.
  const ownedPaths = new Set([PACK_FILES.manifest, PACK_FILES.glossary])
  const existingPaths = listExistingFiles(outputRoot).filter(
    (path) => path.startsWith("flows/") || ownedPaths.has(path)
  )

  const orphansRemoved = planOrphanRemovals({ existingPaths, expectedPaths })
  for (const orphan of orphansRemoved) {
    bump(ruleCounts, "prune-orphaned-output")
    removeFileAndEmptyParents(outputRoot, orphan.path)
  }

  let filesWritten = 0
  for (const file of plannedFiles) {
    const { written } = writeFileIfChanged(
      join(outputRoot, ...file.path.split("/")),
      file.contents
    )
    if (written) filesWritten += 1
  }

  /* ---------------------------------------------------------------- verify */

  const verification = verifyOutput({
    outputRoot,
    expectedPaths,
    reasonCodeVocabulary,
  })

  /* ------------------------------------------- per-flow vocabulary assertion */

  for (const code of codes) {
    const flow = readFlow(sourceRoot, code)
    assertReasonCodesResolve({
      code,
      uiJson: flow.base["ui.json"].json,
      resultJson: flow.base["result.json"].json,
      vocabulary: reasonCodeVocabulary,
    })
    bump(ruleCounts, "assert-reason-codes-resolve")
  }

  /* ---------------------------------------------------------------- report */

  const bindings = Object.entries(bespokeMap.bindings)
    .map(([subTabId, binding]) => ({
      subTabId,
      component: binding.component,
      dataPathCandidates:
        bespokeMap.components[binding.component].dataPathCandidates,
    }))
    .sort((a, b) => (a.subTabId < b.subTabId ? -1 : 1))

  const report = renderReport({
    sourceRoot,
    counts: {
      flows: codes.length,
      bundles: bundleCount,
      variantDirectories: variantDirectoryCount,
      subjectRefs: uniqueRefs,
      filesWritten: expectedPaths.length,
      rules: ruleCounts,
    },
    drops,
    divergences,
    transforms,
    passMarks,
    bespoke: { bindings },
    vocabularies: {
      decisionOptions: [...decisionOptions.keys()].sort(),
      reasonCodeCount: reasonCodeVocabulary.size,
      bypassCodeCount: bypassCodes.size,
      drift,
    },
    governance: {
      notes: [
        {
          surface: "`pack.json` → `moduleWeekMapping`",
          state: "not approved — unassigned (§45.3)",
        },
        {
          surface: "`pass_standards` → flow pass mark",
          state: "not approved — evidence only (§45.1)",
        },
      ],
    },
    reservedAnswerKeyPaths,
    sizes,
    verification,
    orphansRemoved,
    subjectRefCollisions,
  })

  writeFileIfChanged(
    join(outputRoot, PACK_FILES.report),
    await serializeMarkdown(report, formatting)
  )

  return {
    flows: codes.length,
    bundles: bundleCount,
    filesPlanned: expectedPaths.length,
    filesWritten,
    drops: drops.length,
    orphansRemoved: orphansRemoved.length,
    liveFlowsByFile,
    verification,
    sizes,
    reasonCodeVocabularySize: reasonCodeVocabulary.size,
    decisionOptions: [...decisionOptions.keys()].sort(),
    subjectRefs: uniqueRefs,
    subjectRefCollisions,
  }
}
