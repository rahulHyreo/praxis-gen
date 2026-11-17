import { describe, expect, it } from "vitest"
import path from "node:path"

import config, { codeCommands, dataCommands } from "./lint-staged.config.mjs"

// lint-staged hands absolute paths. The helpers derive everything from
// process.cwd(), which is the repo root when the hook runs.
const abs = (p) => path.join(process.cwd(), ...p.split("/"))

describe("code files", () => {
  it("formats every staged file with one prettier call from the root", () => {
    const cmds = codeCommands([
      abs("apps/api/src/server.ts"),
      abs("apps/web/src/App.tsx"),
    ])
    const prettier = cmds.filter((c) => c.startsWith("prettier"))
    expect(prettier).toHaveLength(1)
    expect(prettier[0]).toContain('"apps/api/src/server.ts"')
    expect(prettier[0]).toContain('"apps/web/src/App.tsx"')
  })

  it("runs eslint once per owning package", () => {
    const cmds = codeCommands([
      abs("apps/api/src/server.ts"),
      abs("apps/api/src/index.ts"),
      abs("apps/web/src/App.tsx"),
    ])
    const eslint = cmds.filter((c) => c.includes("eslint"))
    expect(eslint).toHaveLength(2)
    expect(eslint.some((c) => c.startsWith("pnpm -C apps/api "))).toBe(true)
    expect(eslint.some((c) => c.startsWith("pnpm -C apps/web "))).toBe(true)
  })

  it("passes paths RELATIVE TO THE PACKAGE, not the repo root", () => {
    // `pnpm -C <pkg>` changes the cwd, so a repo-relative path would not
    // resolve. This is the detail that breaks if someone "simplifies" the
    // config to a single root-level eslint call.
    const cmds = codeCommands([abs("apps/api/src/server.ts")])
    const eslint = cmds.find((c) => c.includes("eslint"))
    expect(eslint).toContain('"src/server.ts"')
    expect(eslint).not.toContain('"apps/api/src/server.ts"')
  })

  it("points eslint at the package's own flat config", () => {
    // Flat config resolves only from the cwd; naming it explicitly is what
    // makes `-C <pkg>` sufficient.
    const cmds = codeCommands([abs("packages/db/src/ids.ts")])
    const eslint = cmds.find((c) => c.includes("eslint"))
    expect(eslint).toContain("--config eslint.config.js")
    expect(eslint).toContain("--fix")
    expect(eslint).toContain("--no-warn-ignored")
  })

  it("invokes eslint through pnpm, never as a bare binary", () => {
    // Under pnpm the eslint binary is NOT hoisted to the root
    // node_modules/.bin, so a bare `eslint` from the root fails outright.
    const cmds = codeCommands([abs("packages/ui/src/lib/utils.ts")])
    for (const cmd of cmds.filter((c) => c.includes("eslint"))) {
      expect(cmd.startsWith("pnpm -C ")).toBe(true)
    }
  })

  it("gives a root-level file prettier only — there is no root eslint config", () => {
    const cmds = codeCommands([abs("lint-staged.config.mjs")])
    expect(cmds).toHaveLength(1)
    expect(cmds[0].startsWith("prettier")).toBe(true)
  })

  it("still lints the package files in a mixed batch", () => {
    const cmds = codeCommands([
      abs("vitest.workspace.ts"),
      abs("packages/shared/src/index.ts"),
    ])
    const eslint = cmds.filter((c) => c.includes("eslint"))
    expect(eslint).toHaveLength(1)
    expect(eslint[0]).toContain("pnpm -C packages/shared ")
  })

  it("recognises every workspace package", () => {
    for (const pkg of [
      "apps/api",
      "apps/web",
      "packages/db",
      "packages/shared",
      "packages/ui",
    ]) {
      const cmds = codeCommands([abs(`${pkg}/src/x.ts`)])
      expect(
        cmds.some((c) => c.startsWith(`pnpm -C ${pkg} `)),
        `${pkg} should be linted by its own config`
      ).toBe(true)
    }
  })

  it("does not treat a lookalike path as a package", () => {
    // "packages/dbx" starts with neither "packages/db/" nor any other root.
    const cmds = codeCommands([abs("packages/dbx/src/x.ts")])
    expect(cmds.filter((c) => c.includes("eslint"))).toHaveLength(0)
  })
})

describe("data files", () => {
  it("formats them with prettier and nothing else", () => {
    const cmd = dataCommands([
      abs("packs/claims/pack.json"),
      abs("docs/SPEC.md"),
    ])
    expect(cmd.startsWith("prettier --write")).toBe(true)
    expect(cmd).not.toContain("eslint")
  })

  it("gives a packs/ JSON file prettier only", () => {
    // Authored pack content is data, not code (SPEC §5). ESLint must not be
    // pointed at it.
    const cmd = dataCommands([abs("packs/claims/flows/X/data.json")])
    expect(cmd).toContain('"packs/claims/flows/X/data.json"')
    expect(cmd).not.toContain("eslint")
  })
})

describe("the exported config", () => {
  it("routes code extensions to the grouping builder", () => {
    expect(config["*.{ts,tsx,js,jsx,mjs,cjs}"]).toBe(codeCommands)
  })

  it("routes data extensions to the prettier-only builder", () => {
    expect(config["*.{json,md,yml,yaml,css,html}"]).toBe(dataCommands)
  })

  it("covers the file types this repository actually stages", () => {
    const patterns = Object.keys(config).join(" ")
    for (const ext of ["ts", "tsx", "mjs", "json", "md", "yaml", "css"]) {
      expect(patterns).toContain(ext)
    }
  })
})
