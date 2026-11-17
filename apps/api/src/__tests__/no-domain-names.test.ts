import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import {
  PACK_VOCABULARY,
  ALLOW_LIST,
  SWEPT_DIRECTORIES,
  findPackVocabulary,
  type Violation,
} from "./no-domain-names.js"

/**
 * docs/SPEC.md §43's no-domain-names guard, and §Non-negotiables' rule:
 *
 *   "No domain-specific names (claim, DCN, Pay/Deny) in core logic."
 *
 * WHY THIS LANDS IN THE BOOTSTRAP CHANGE. This repository is built by copying
 * scaffolding out of Praxis v1 — which *is* the claims platform, with 47
 * claims-named services, 15 claims route modules and claims vocabulary in its
 * comments, type names and fixtures. This change is therefore the one most able
 * to leak that vocabulary, and the moment the guard is cheapest to establish:
 * it passes trivially today, and every later change inherits it.
 *
 * Domain content is pack configuration (§5). A service that names a claim has
 * stopped being configurable and become claims-shaped, which is the failure the
 * whole pack architecture exists to prevent — and it is not a failure a reviewer
 * reliably notices, because each individual occurrence looks harmless.
 */

// fileURLToPath, NOT `new URL(...).pathname`.
//
// On Windows `pathname` is percent-encoded — this repository lives under
// "My Web Projects", so it arrives as "/D:/My%20Web%20Projects/..." and every
// fs call on it throws ENOENT. The first version of this guard used `pathname`,
// swallowed those errors in the sweep's catch, and so swept ZERO files: it
// passed its own suite while failing to flag a planted violation. Hence also
// the "sweeps a non-zero number of files" test below — an empty sweep must
// fail loudly, not pass quietly.
const API_SRC = fileURLToPath(new URL("../", import.meta.url))

/** Every .ts file under the swept directories, excluding tests. */
function sweptFiles(): string[] {
  const out: string[] = []
  for (const dir of SWEPT_DIRECTORIES) {
    const root = join(API_SRC, dir)
    let entries: string[]
    try {
      entries = readdirSync(root, { recursive: true }) as string[]
    } catch (err) {
      // A swept directory that does not exist yet is not a failure — the
      // folders are established by this change and filled by later ones. Any
      // OTHER error is a fault in the guard itself and must surface, because a
      // sweep that silently reads nothing is a guard that always passes.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue
      throw err
    }
    for (const entry of entries) {
      const abs = join(root, entry)
      if (!abs.endsWith(".ts") && !abs.endsWith(".tsx")) continue
      if (/[\\/]__tests__[\\/]/.test(abs)) continue
      if (/\.test\.tsx?$/.test(abs)) continue
      if (!statSync(abs).isFile()) continue
      out.push(abs)
    }
  }
  return out
}

describe("pack vocabulary is barred from core services", () => {
  it("sweeps at least the directories §43 names", () => {
    expect(SWEPT_DIRECTORIES).toContain("services")
    expect(SWEPT_DIRECTORIES.length).toBeGreaterThan(0)
  })

  it("actually reads files — an empty sweep must fail, not pass", () => {
    // THE test that makes this guard trustworthy. A sweep that reads nothing
    // reports no violations and looks identical to a clean tree. That is not
    // hypothetical: the first version of this file resolved API_SRC with
    // `new URL(...).pathname`, which is percent-encoded on Windows, so every
    // fs call threw, the catch swallowed it, and the guard passed while a
    // planted violation in services/ went unnoticed.
    const files = sweptFiles()
    expect(files.length).toBeGreaterThan(0)

    // And it is reading the right tree.
    const rel = files.map((f) => relative(API_SRC, f).split("\\").join("/"))
    expect(rel).toContain("routes/health.ts")
    expect(rel).toContain("middleware/error.middleware.ts")
  })

  it("finds no pack vocabulary in the current tree", () => {
    const violations: Violation[] = []
    for (const file of sweptFiles()) {
      const rel = relative(API_SRC, file).split("\\").join("/")
      violations.push(...findPackVocabulary(rel, readFileSync(file, "utf8")))
    }

    // Reported with file, line and term, so a failure says what to fix rather
    // than only that something is wrong.
    const report = violations
      .map((v) => `  ${v.file}:${v.line} — "${v.term}" in: ${v.text.trim()}`)
      .join("\n")

    expect(
      violations,
      violations.length
        ? `Pack vocabulary found in core services (SPEC §Non-negotiables, §43).\n` +
            `Domain content belongs in a pack (§5), not in a core service.\n` +
            `If this file is genuinely a pack-scoped adapter, add it to ALLOW_LIST\n` +
            `in no-domain-names.ts with a comment saying why.\n\n${report}`
        : undefined
    ).toEqual([])
  })

  it("confirms no v1 service, route or fixture was carried over", () => {
    // The flip side of the sweep: v1's claims services are absent entirely,
    // not merely renamed. A mechanical rename would pass the sweep while
    // leaving the architecture claims-shaped (design D3).
    const files = sweptFiles().map((f) =>
      relative(API_SRC, f).split("\\").join("/")
    )
    for (const carried of [
      "services/flow-bundle.service.ts",
      "services/rubric-scoring.ts",
      "services/assessment-claim-scoring.service.ts",
      "routes/attempts.ts",
      "routes/assessments.ts",
    ]) {
      expect(files).not.toContain(carried)
    }
  })
})

describe("findPackVocabulary", () => {
  it("flags each barred term", () => {
    for (const term of PACK_VOCABULARY) {
      const found = findPackVocabulary(
        "services/x.service.ts",
        `export const ${term}Thing = 1\n`
      )
      expect(found.length, `${term} should be flagged`).toBeGreaterThan(0)
      expect(found[0].term).toBe(term)
    }
  })

  it("reports the file, the 1-indexed line and the term", () => {
    const found = findPackVocabulary(
      "services/x.service.ts",
      "const a = 1\nconst b = 2\n// a note about a claim\n"
    )
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      file: "services/x.service.ts",
      line: 3,
      term: "claim",
    })
  })

  it("flags vocabulary in a comment, not just in code", () => {
    // A comment naming a claim is how the vocabulary actually arrives when
    // scaffolding is copied — the identifier gets renamed and the comment
    // does not.
    const found = findPackVocabulary(
      "services/x.service.ts",
      "// returns the DCN for this subject\n"
    )
    expect(found).toHaveLength(1)
    expect(found[0].term).toBe("dcn")
  })

  it("is case-insensitive", () => {
    for (const text of [
      "const Claim = 1",
      "const CLAIM = 1",
      "type DcnRef = string",
    ]) {
      expect(findPackVocabulary("services/x.ts", text).length).toBeGreaterThan(
        0
      )
    }
  })

  it("matches whole words only", () => {
    // "payload", "payer", "display", "claimant"-free words must not trip it, or
    // the guard becomes noise and gets disabled — which is worse than no guard.
    for (const text of [
      "const payload = {}",
      "const payer = 'acme'",
      "function displayName() {}",
      "const repayment = 1",
      "const denylist = []",
      "const okpay = 1",
    ]) {
      expect(
        findPackVocabulary("services/x.ts", text),
        `should not flag: ${text}`
      ).toEqual([])
    }
  })

  it("flags a term adjacent to punctuation or in camelCase", () => {
    for (const text of [
      "const x = subject.claim",
      "const claimId = 1",
      "const subjectDcn = 'x'",
      "if (decision === 'deny') {}",
      "doPay()",
    ]) {
      expect(
        findPackVocabulary("services/x.ts", text).length,
        `should flag: ${text}`
      ).toBeGreaterThan(0)
    }
  })

  it("reports every distinct term on one line", () => {
    const found = findPackVocabulary(
      "services/x.ts",
      "// a claim may pay or deny\n"
    )
    expect(found.map((v) => v.term).sort()).toEqual(["claim", "deny", "pay"])
  })

  it("passes a file on the allow-list", () => {
    // Exercised with an injected list: the real ALLOW_LIST is empty today (no
    // pack-scoped adapter exists yet), and a test that silently proves nothing
    // when a list is empty is worse than no test.
    const list = ["services/claims-adapter.service.ts"]
    expect(findPackVocabulary(list[0], "const claim = 1\n", list)).toEqual([])
  })

  it("flags a file whose path merely resembles an allow-listed one", () => {
    const list = ["services/claims-adapter.service.ts"]
    expect(
      findPackVocabulary(
        "services/claims-adapter.service.ts.bak",
        "const claim = 1\n",
        list
      ).length
    ).toBeGreaterThan(0)
  })

  it("matches an allow-list entry exactly, not as a prefix or suffix", () => {
    const list = ["lib/x.ts"]
    expect(
      findPackVocabulary("services/lib/x.ts", "const claim = 1", list).length
    ).toBeGreaterThan(0)
  })
})

describe("the allow-list", () => {
  it("is empty, because no pack-scoped adapter exists yet", () => {
    // Asserted rather than assumed. The guard's credibility rests on the
    // allow-list being the exception it claims to be, so the moment the first
    // entry is added this test fails and forces the author to say so here.
    expect(ALLOW_LIST).toEqual([])
  })

  it("is a declared array, not a pattern", () => {
    // §43 and design D4: an exception must be a visible diff. A glob broad
    // enough to absorb a new violation defeats the guard silently.
    expect(Array.isArray(ALLOW_LIST)).toBe(true)
    for (const entry of ALLOW_LIST) {
      expect(entry).not.toContain("*")
      expect(entry).not.toContain("?")
    }
  })

  it("holds no duplicate entries", () => {
    expect(new Set(ALLOW_LIST).size).toBe(ALLOW_LIST.length)
  })

  it("names only paths that exist", () => {
    // A stale entry is an exception nobody can see is unused, and it would
    // quietly permit a future file at that path.
    for (const entry of ALLOW_LIST) {
      expect(
        () => statSync(join(API_SRC, entry)),
        `${entry} does not exist`
      ).not.toThrow()
    }
  })
})
