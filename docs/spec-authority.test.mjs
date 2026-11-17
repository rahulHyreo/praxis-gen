import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The documentation contract (docs/SPEC.md §2).
 *
 * Three documents state the precedence order and name each other's paths. A
 * precedence rule pointing at a file that does not exist is worse than no rule,
 * because agents and people follow it and then silently fall through to the
 * next authority — which is exactly the state this repository started in, with
 * `openspec/config.yaml` naming a `SPEC.md` at the repo root that never existed.
 *
 * Runs in the `root-tooling` vitest project, so `pnpm test` covers it.
 */

const REPO = process.cwd()
const read = (p) => readFileSync(join(REPO, p), "utf8")

/**
 * Prose, with markdown emphasis removed and whitespace collapsed.
 *
 * Assertions about what a document SAYS must not depend on where its lines
 * happen to wrap or whether a word is bolded — Prettier rewraps these files,
 * so a raw-substring assertion breaks on reformatting rather than on meaning.
 * (An earlier version of this file asserted on the raw text and failed on
 * "no schema" purely because the README bolds the "no".)
 */
const prose = (p) => read(p).replace(/\*\*?/g, "").replace(/\s+/g, " ")

const SPEC = "docs/SPEC.md"
const V1_SPEC = "docs/v1-SPEC.md"
const CLAUDE = "CLAUDE.md"
const CONFIG = "openspec/config.yaml"
const README = "README.md"

describe("the documents exist at the paths §2 names", () => {
  it.each([SPEC, V1_SPEC, CLAUDE, CONFIG, README, "TESTING.md"])(
    "%s exists",
    (p) => {
      expect(existsSync(join(REPO, p)), `${p} is missing`).toBe(true)
    }
  )

  it("every path named in any statement of the precedence order resolves", () => {
    const named = new Set()
    for (const file of [CLAUDE, CONFIG, README]) {
      for (const m of read(file).matchAll(
        /docs\/(?:v1-)?SPEC\.md|openspec\/specs/g
      )) {
        named.add(m[0])
      }
    }
    expect(named.size).toBeGreaterThan(0)
    for (const path of named) {
      expect(existsSync(join(REPO, path)), `${path} is named but missing`).toBe(
        true
      )
    }
  })
})

describe("docs/SPEC.md is the specification", () => {
  const spec = read(SPEC)

  it("carries the § anchors that every artifact cites", () => {
    expect((spec.match(/§\d+/g) ?? []).length).toBeGreaterThan(100)
  })

  it("keeps its §42 deployment section unedited", () => {
    // Design D10: narrowing a CHANGE's scope must not narrow the
    // SPECIFICATION. Deployment is deferred, not abandoned, and the record of
    // that lives here.
    expect(spec).toMatch(/§42/)
    for (const term of [
      "Swarm",
      "Jenkins",
      "Ansible",
      "PRAXIS_DEPLOY_ENABLED",
    ]) {
      expect(spec, `§42 should still mention ${term}`).toContain(term)
    }
  })

  it("has its diagrams inside fenced code blocks", () => {
    // Unfenced, Prettier reflows the aligned ASCII into unreadable single
    // lines — which it did, until they were fenced. This is the test that
    // keeps them fenced.
    const fences = (spec.match(/^```/gm) ?? []).length
    expect(fences).toBeGreaterThanOrEqual(12)
    expect(fences % 2, "fences must be balanced").toBe(0)
  })

  it("fences the specific diagrams that were being mangled", () => {
    for (const first of [
      "apps/web                 React 19",
      "programs ── tracks",
      "packs/<pack-id>/",
      "navigatorScore  = v1 formula",
      "sectionPoints[s]",
      "SIGN IN (OTP)",
    ]) {
      const at = spec.indexOf(first)
      expect(at, `${first} not found`).toBeGreaterThan(-1)
      const before = spec.slice(0, at).trimEnd()
      expect(
        before.endsWith("```text"),
        `the block starting "${first.slice(0, 30)}…" is not fenced`
      ).toBe(true)
    }
  })

  it("preserves the alignment inside a fenced diagram", () => {
    // Two consecutive lines of the layout tree, with their padding intact.
    expect(spec).toContain(
      "apps/web                 React 19 + Vite 7 + Tailwind v4 + shadcn/ui, React Router v7,"
    )
    expect(spec).toContain(
      "                         Zustand, TanStack Form/Table/Query          (dev port 5173)"
    )
  })
})

describe("docs/v1-SPEC.md is a bounded reference", () => {
  const v1 = read(V1_SPEC)

  it("bounds its authority to [v1] items and cedes to docs/SPEC.md", () => {
    expect(v1).toMatch(/\[v1\]/)
    expect(v1).toMatch(/docs\/SPEC\.md.* wins|wins.*docs\/SPEC\.md/s)
  })

  it("records that v1's spec is not actually at docs/SPEC.md", () => {
    // §2 describes this as v1's `docs/SPEC.md`. No such file exists in the v1
    // repository; its spec is docs/SDD-master-spec.md. Papering over that
    // would send the next reader looking for a file that never existed.
    expect(v1).toContain("SDD-master-spec.md")
  })

  it("repeats v1's own trust-the-code warning", () => {
    // v1's CLAUDE.md: some numbers in that document have drifted from its
    // code. The trainee ID format is the live example.
    expect(v1).toContain("HYTR-")
    expect(v1).toContain("HYTE-")
    expect(v1).toMatch(/trust the code/i)
  })

  it("is marked as a snapshot, not a synced copy", () => {
    expect(v1).toMatch(/snapshot/i)
  })
})

describe("CLAUDE.md points rather than restates", () => {
  const claude = read(CLAUDE)

  it("names both specification documents and the precedence order", () => {
    expect(claude).toContain("docs/SPEC.md")
    expect(claude).toContain("docs/v1-SPEC.md")
    expect(claude).toContain("openspec/specs/")
    expect(claude).toMatch(/trust the code/i)
  })

  it("does not carry the specification's numbered sections", () => {
    // The duplicate is gone: `spec-authority` requires the text to exist in
    // exactly one place. A handful of § citations is the point of the file;
    // a hundred would mean the spec had been copied back in.
    expect((claude.match(/§\d+/g) ?? []).length).toBeLessThan(40)
    for (const heading of [
      "§1 — Purpose and scope",
      "§4 — Program model",
      "§45 — Governance decisions",
    ]) {
      expect(claude).not.toContain(heading)
    }
  })

  it("is the short form", () => {
    // It was 58 KB when it held the whole specification.
    expect(claude.length).toBeLessThan(12000)
  })
})

describe("openspec/config.yaml agrees", () => {
  const config = read(CONFIG)

  it("names docs/SPEC.md, not a repo-root SPEC.md", () => {
    expect(config).toContain("docs/SPEC.md is the build specification")
    expect(config).not.toMatch(/SPEC\.md at the repo root/)
  })

  it("names docs/v1-SPEC.md at its real path in the precedence order", () => {
    expect(config).toContain("docs/v1-SPEC.md")
  })
})

describe("README.md describes v2, not v1", () => {
  const readme = read(README)

  const readmeProse = prose(README).toLowerCase()

  it("states what does not exist yet", () => {
    for (const phrase of ["no schema", "no authentication", "no content"]) {
      expect(readmeProse).toContain(phrase)
    }
  })

  it("states that deployment is deferred, not abandoned", () => {
    expect(readmeProse).toContain("deferred")
    expect(readme).toMatch(/§42/)
    expect(readmeProse).toContain("narrowed scope, not a changed plan")
  })

  it("documents the branch and the §Workflow commit prefixes", () => {
    expect(readme).toContain("develop")
    for (const prefix of [
      "feat",
      "fix",
      "schema",
      "api",
      "ui",
      "store",
      "seed",
      "test",
      "chore",
      "pack",
    ]) {
      expect(readme, `commit prefix ${prefix}`).toContain(prefix)
    }
  })

  it("describes the v2 layout, including packs/", () => {
    expect(readme).toContain("packs/")
    expect(readme).toContain("@workspace/ui")
    expect(readme).toContain("@platform/shared")
  })

  it("does not present v1's claims features as v2 features of this change", () => {
    // It may name the Claims *pack* — that is v2's first domain pack — but it
    // must not describe a claim workspace, scenarios or adjudication as
    // something this repository has.
    for (const phrase of [
      "claim workspace",
      "Claim Workspace",
      "scenario tree",
      "adjudication engine",
    ]) {
      expect(readme).not.toContain(phrase)
    }
  })
})

describe("TESTING.md describes v2", () => {
  const testing = read("TESTING.md")

  it("covers the PGlite path, the ratchet and the deferral register", () => {
    expect(testing).toContain("PGlite")
    expect(testing).toMatch(/ratchet/i)
    expect(testing).toMatch(/Deferred/)
  })

  it("names every deferred §43 guard with an owner", () => {
    for (const guard of [
      "Answer-key leak",
      "AI auto-accept",
      "COMPLETION_TRIGGERS",
      "Snapshot immutability",
      "HITRUST",
    ]) {
      expect(testing, `${guard} should be in the register`).toContain(guard)
    }
  })

  it("names the one implemented guard", () => {
    expect(testing).toContain("no-domain-names.test.ts")
  })
})
