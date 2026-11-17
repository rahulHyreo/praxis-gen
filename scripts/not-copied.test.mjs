import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * The "Deliberately NOT copied" boundary (this change's proposal, design D3).
 *
 * The bootstrap is built by copying scaffolding out of Praxis v1, which IS the
 * claims platform. The proposal lists what was deliberately left behind; this
 * asserts it stayed behind, so a later change cannot quietly reintroduce a
 * claims-shaped file and have the boundary erode unnoticed.
 *
 * Runs in the `root-tooling` vitest project, so `pnpm test` covers it.
 */

const REPO = process.cwd()
const has = (p) => existsSync(join(REPO, p))

describe("v1 implementation is absent", () => {
  it("carries no v1 service", () => {
    for (const f of [
      "apps/api/src/services/flow-bundle.service.ts",
      "apps/api/src/services/rubric-scoring.ts",
      "apps/api/src/services/score-normalization.ts",
      "apps/api/src/services/assessment-scoring.service.ts",
      "apps/api/src/services/leaderboard-components.ts",
      "apps/api/src/services/at-risk.ts",
      "apps/api/src/services/proctoring-config.service.ts",
    ]) {
      expect(has(f), `${f} should not exist`).toBe(false)
    }
  })

  it("carries no v1 route module", () => {
    for (const f of [
      "apps/api/src/routes/attempts.ts",
      "apps/api/src/routes/assessments.ts",
      "apps/api/src/routes/assessment-sessions.ts",
      "apps/api/src/routes/training.ts",
      "apps/api/src/routes/teaching.ts",
      "apps/api/src/routes/cohorts.ts",
      "apps/api/src/routes/admin/scenarios.ts",
    ]) {
      expect(has(f), `${f} should not exist`).toBe(false)
    }
  })

  it("carries no v1 web feature", () => {
    for (const f of [
      "apps/web/src/features/admin-scenarios",
      "apps/web/src/features/training",
      "apps/web/src/features/trainee-assessment",
      "apps/web/src/features/leaderboard",
      "apps/web/src/features/reports",
      "apps/web/src/features/mcq",
    ]) {
      expect(has(f), `${f} should not exist`).toBe(false)
    }
  })

  it("starts its schema fresh, with no v1 tables", () => {
    // §40: "the v2 migration set starts fresh (0000_init)".
    const schema = readFileSync(join(REPO, "packages/db/src/schema.ts"), "utf8")
    // The header documents the groups; no table may be DEFINED.
    expect(schema).not.toMatch(/pgTable\s*\(/)
    expect(schema).not.toMatch(/pgEnum\s*\(/)
  })

  it("carries no v1 migration", () => {
    const dir = join(REPO, "packages/db/drizzle")
    const sql = readdirSync(dir).filter((f) => f.endsWith(".sql"))
    expect(sql).toEqual([])
  })

  it("does not reintroduce what §40 says v2 drops", () => {
    const schema = readFileSync(join(REPO, "packages/db/src/schema.ts"), "utf8")
    // Named in the header as dropped; must not appear as a definition.
    for (const dropped of [
      "workspaceSchemas",
      "navigatorSchemas",
      "navigatorSteps",
      "proxyViolations",
      "trainingMode",
      "claimDecisionType",
    ]) {
      expect(schema).not.toContain(`${dropped} =`)
    }
  })
})

describe("v1 claims scripts are absent", () => {
  it("declares none of them in any package.json", () => {
    const pkgs = [
      "package.json",
      "apps/api/package.json",
      "apps/web/package.json",
      "packages/db/package.json",
    ]
    for (const p of pkgs) {
      const scripts =
        JSON.parse(readFileSync(join(REPO, p), "utf8")).scripts ?? {}
      for (const name of [
        "scenarios:roundtrip",
        "migrate:flow-bundles",
        "backfill:claim-correctness",
        "backfill:scoring",
        "scaffold:variants",
        "validate:variants",
        "sync:search-member",
        "report:flow-points",
      ]) {
        expect(scripts, `${p} declares ${name}`).not.toHaveProperty(name)
      }
    }
  })

  it("declares no command that resolves to nothing", () => {
    // §42 names packs:validate and packs:sync, but the validator does not
    // exist — a script name that resolves to nothing is worse than an absent
    // one, because it looks available.
    const scripts = JSON.parse(
      readFileSync(join(REPO, "package.json"), "utf8")
    ).scripts
    expect(scripts).not.toHaveProperty("packs:validate")
    expect(scripts).not.toHaveProperty("packs:sync")
  })
})

describe("feature-only dependencies are absent", () => {
  it("apps/web declares none of them", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO, "apps/web/package.json"), "utf8")
    )
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const name of [
      "@vladmandic/face-api", // proctoring, §25
      "pdfjs-dist", // document preview
      "docx-preview",
      "exceljs", // reports, §34
      "jspdf",
      "jspdf-autotable",
      "xlsx",
      "papaparse",
      "@xyflow/react", // bundle studio, §10
      "@uiw/react-codemirror",
      "@dnd-kit/core",
      "zundo",
      "@sentry/react",
    ]) {
      expect(deps, `apps/web declares ${name}`).not.toHaveProperty(name)
    }
  })

  it("apps/api declares nothing it cannot import yet", () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO, "apps/api/package.json"), "utf8")
    )
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const name of [
      "better-auth", // §7
      "@sendgrid/mail", // §36
      "@aws-sdk/client-s3", // §13
      "@aws-sdk/s3-request-presigner",
      "ioredis", // §38 cache
      "jose",
    ]) {
      expect(deps, `apps/api declares ${name}`).not.toHaveProperty(name)
    }
  })
})

describe("deployment and V1-local tooling are absent", () => {
  it("carries no CI or provisioning tree", () => {
    for (const d of ["ci", "ansible", ".github", "loadtest", "postman"]) {
      expect(has(d), `${d}/ should not exist`).toBe(false)
    }
  })

  it("carries no V1-local tooling artefact", () => {
    for (const d of [
      "graphify-out",
      ".omc",
      ".agents",
      "secrets",
      "tools",
      "skills-lock.json",
      ".graphifyignore",
    ]) {
      expect(has(d), `${d} should not exist`).toBe(false)
    }
  })

  it("keeps every dependency exact-pinned, per decision D2", () => {
    // A caret range would silently re-resolve and undo the pinning — which is
    // what produced the radix-ui ToggleGroup failure that led to D2 being
    // applied properly.
    for (const p of [
      "package.json",
      "apps/api/package.json",
      "apps/web/package.json",
      "packages/db/package.json",
      "packages/shared/package.json",
      "packages/ui/package.json",
    ]) {
      const pkg = JSON.parse(readFileSync(join(REPO, p), "utf8"))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      for (const [name, spec] of Object.entries(deps)) {
        if (String(spec).startsWith("workspace:")) continue
        expect(
          String(spec),
          `${p}: ${name} is "${spec}" — must be an exact version (D2)`
        ).toMatch(/^\d+\.\d+\.\d+/)
      }
    }
  })
})
