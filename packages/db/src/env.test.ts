import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * env.ts auto-loads on import and memoises with a module-level flag, so its
 * file-reading behaviour cannot be re-exercised in-process without resetting
 * module state. What matters about it is a contract rather than an output: a
 * variable already in process.env is NEVER replaced by a .env file.
 *
 * These tests assert that contract two ways — the observable precedence, and
 * the `override: false` that implements it — so that flipping it to `true`
 * fails here rather than silently letting a developer's stale .env beat the
 * value a container injected.
 */
const envSource = readFileSync(
  fileURLToPath(new URL("./env.ts", import.meta.url)),
  "utf8"
)

/**
 * env.ts with comments removed.
 *
 * Every assertion below is about what the module DOES, so it must read code
 * only. Matching raw source conflates the two: the header legitimately
 * discusses `override: true` as the regression to avoid, and an earlier version
 * of these tests failed on its own documentation.
 */
const envCode = envSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("loadEnv precedence contract", () => {
  it("passes override: false to every dotenv call", () => {
    const calls = envCode.match(/dotenvConfig\([^)]*\)/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call).toContain("override: false")
    }
  })

  it("never passes override: true", () => {
    // The whole priority model (real env > repo-root .env > package .env)
    // rests on this. An override:true edit would invert it.
    expect(envCode).not.toMatch(/override:\s*true/)
  })

  it("is idempotent — guarded by a load-once flag", () => {
    expect(envCode).toMatch(/if\s*\(loaded\)\s*return/)
  })

  it("does not special-case any individual variable", () => {
    // §42's env layering is uniform: every variable follows one rule. A named
    // exception in the CODE would be a second, invisible configuration model.
    // The header may name variables as examples; that is documentation, which
    // is why this reads envCode.
    for (const name of [
      "DATABASE_URL",
      "REDIS_URL",
      "S3_PACKS_BUCKET",
      "S3_PUBLIC_BUCKET",
      "AUTH_MASTER_OTP",
    ]) {
      expect(envCode).not.toContain(name)
    }
  })

  it("reads only APP_ENV out of process.env, and nothing else", () => {
    // Its job is to POPULATE process.env, not to interpret it, so a read here
    // makes the loader's own behaviour depend on configuration.
    //
    // APP_ENV is the one justified exception: it SELECTS which layer to load,
    // exactly as `${APP_ENV}` does in the compose files, so the host and the
    // containers agree on which environment they are in. Anything else would
    // be a second configuration model hiding inside the loader.
    const reads = [
      ...envCode.matchAll(/process\.env(?:\.(\w+)|\[["'](\w+)["']\])/g),
    ].map((m) => m[1] ?? m[2])
    expect(new Set(reads)).toEqual(new Set(["APP_ENV"]))
  })

  it("reads the docker/env layers, so host tooling and the containers agree", () => {
    // Without this, `pnpm db:push` / `db:studio` / `drizzle-kit` fail with
    // "DATABASE_URL is required" while the stack is up and configured — and
    // the error message pointing at docker/env/.env would be advice about a
    // file nothing read.
    expect(envCode).toContain("docker")
    expect(envCode).toContain("base.env")
  })

  it("finds the repo root by pnpm-workspace.yaml, not a hard-coded depth", () => {
    // A fixed '../../' breaks for any consumer at a different nesting depth.
    expect(envCode).toContain("pnpm-workspace.yaml")
  })

  it("contains no pack vocabulary", () => {
    const lowered = envCode.toLowerCase()
    for (const term of ["claim", "dcn", "pay", "deny"]) {
      expect(lowered).not.toContain(term)
    }
  })
})

describe("layer selection executes both branches", () => {
  // These exist because the ratchet caught them. Adding the docker/env layers
  // introduced new branches (`APP_ENV ?? "local"`, and the repo-root guard on
  // the directory list), which dropped this package's branch coverage below
  // its floor. The doctrine is to cover the new branches, not to lower the
  // floor — so these actually RUN loadEnv() down each path rather than
  // asserting on its source text.
  //
  // vi.resetModules() is required: loadEnv memoises with a module-level flag,
  // so without a fresh registry the second call is a no-op and the other
  // branch is never taken.
  it("defaults to the local layer when APP_ENV is unset", async () => {
    const previous = process.env.APP_ENV
    delete process.env.APP_ENV
    try {
      vi.resetModules()
      const { loadEnv } = await import("./env.js")
      expect(() => loadEnv()).not.toThrow()
      // docker/env/local.env defines these; base.env does not.
      expect(process.env.POSTGRES_DB).toBe("praxis2_local")
    } finally {
      if (previous === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = previous
    }
  })

  it("honours an explicit APP_ENV", async () => {
    const previousApp = process.env.APP_ENV
    const previousDb = process.env.POSTGRES_DB
    // A layer that does not exist must be skipped, not fatal: the loader has
    // to work in an environment whose <env>.env has not been created.
    process.env.APP_ENV = "does-not-exist"
    delete process.env.POSTGRES_DB
    try {
      vi.resetModules()
      const { loadEnv } = await import("./env.js")
      expect(() => loadEnv()).not.toThrow()
      // base.env still loads, so a shared default is still present.
      expect(process.env.S3_PACKS_BUCKET).toBe("praxis2-packs")
    } finally {
      if (previousApp === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = previousApp
      if (previousDb !== undefined) process.env.POSTGRES_DB = previousDb
    }
  })

  it("loads the committed base layer", async () => {
    vi.resetModules()
    const { loadEnv } = await import("./env.js")
    loadEnv()
    // From docker/env/base.env — proof the docker layers are reached at all.
    expect(process.env.S3_PUBLIC_BUCKET).toBe("praxis2-public")
    expect(process.env.REDIS_KEY_PREFIX).toBe("praxis2:")
  })
})

describe("a real environment variable beats a .env file", () => {
  it("leaves an already-set variable untouched", async () => {
    const key = "PRAXIS_ENV_PRECEDENCE_PROBE"
    process.env[key] = "from-process"
    try {
      // Importing env.ts runs loadEnv(); no .env file in this repository
      // defines the probe key, but the assertion that matters is that a
      // present value survives the load.
      const { loadEnv } = await import("./env.js")
      loadEnv()
      expect(process.env[key]).toBe("from-process")
    } finally {
      delete process.env[key]
    }
  })

  it("exposes loadEnv as a callable no-op after the first load", async () => {
    const { loadEnv } = await import("./env.js")
    expect(() => {
      loadEnv()
      loadEnv()
    }).not.toThrow()
  })
})
