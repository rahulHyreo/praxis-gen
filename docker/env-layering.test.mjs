import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * The env layering contract (docs/SPEC.md §42).
 *
 * These run in the `root-tooling` vitest project, so `pnpm test` covers them.
 * They are deliberately DAEMON-FREE: they exercise `load-env.sh` and read the
 * committed files, so they hold on a machine with Docker stopped. Bringing the
 * stack up is a separate, manual verification (task 13.12 onward).
 */

const REPO = process.cwd()
const ENV_DIR = join(REPO, "docker", "env")

const read = (name) => readFileSync(join(ENV_DIR, name), "utf8")

/** Source load-env.sh in a POSIX shell and dump the resulting environment. */
function loadEnv({ extra } = {}) {
  let tmp
  const dotenv = join(ENV_DIR, ".env")
  try {
    if (extra !== undefined) {
      tmp = dotenv
      writeFileSync(tmp, extra)
    }
    const out = execFileSync(
      "sh",
      ["-c", ". ./docker/load-env.sh >/dev/null 2>&1; env"],
      { cwd: REPO, encoding: "utf8" }
    )
    const vars = {}
    for (const line of out.split(/\r?\n/)) {
      const eq = line.indexOf("=")
      if (eq > 0) vars[line.slice(0, eq)] = line.slice(eq + 1)
    }
    return vars
  } finally {
    if (tmp) rmSync(tmp, { force: true })
  }
}

describe("layer precedence", () => {
  it("exports keys from base.env", () => {
    const env = loadEnv()
    expect(env.S3_PACKS_BUCKET).toBe("praxis2-packs")
    expect(env.REDIS_KEY_PREFIX).toBe("praxis2:")
  })

  it("lets local.env override base.env", () => {
    // base.env sets no DATABASE_URL; local.env does. The observable rule is
    // that a later layer's value is the one that survives.
    const env = loadEnv()
    expect(env.DATABASE_URL).toContain("praxis2_local")
    expect(env.POSTGRES_DB).toBe("praxis2_local")
  })

  it("lets the gitignored .env override both", () => {
    const env = loadEnv({ extra: "POSTGRES_DB=overridden-by-dotenv\n" })
    expect(env.POSTGRES_DB).toBe("overridden-by-dotenv")
  })

  it("treats a missing .env as ordinary, not an error", () => {
    // compose marks that layer `required: false`; load-env.sh must agree.
    const env = loadEnv()
    expect(env.POSTGRES_DB).toBe("praxis2_local")
  })
})

describe("load-env.sh robustness", () => {
  it("survives a value containing spaces", () => {
    // THE reason this is a read loop and not `set -a; . file`. POSIX `source`
    // EXECUTES the file, so `NAME=Praxis Training Platform` would try to run
    // "Training Platform" and, under set -e, abort the caller.
    const env = loadEnv({ extra: "SPACEY_VALUE=Praxis Training Platform\n" })
    expect(env.SPACEY_VALUE).toBe("Praxis Training Platform")
  })

  it("does not execute the tail of such a value", () => {
    // If the value were executed, the shell would report a command-not-found
    // for the second word. Sourcing must stay inert.
    const out = execFileSync(
      "sh",
      [
        "-c",
        'printf "PROBE=Praxis NotACommand\\n" > docker/env/.env; ' +
          ". ./docker/load-env.sh 2>&1; " +
          'printf "%s\\n" "$PROBE"; rm -f docker/env/.env',
      ],
      { cwd: REPO, encoding: "utf8" }
    )
    expect(out).toContain("Praxis NotACommand")
    expect(out).not.toMatch(/not found|No such file/i)
  })

  it("ignores comments and blank lines", () => {
    const env = loadEnv({ extra: "\n# a comment\n\nCOMMENTED_OK=yes\n" })
    expect(env.COMMENTED_OK).toBe("yes")
    expect(env["# a comment"]).toBeUndefined()
  })
})

describe("committed files hold no external credential", () => {
  // Decision D11: v1 commits a live SendGrid key, the Better Auth secret and
  // database passwords, and its README says "treat repo read access as
  // production root access". v2 does not inherit that. This is the test that
  // holds every later change to it.
  const committed = ["base.env", "local.env"]

  it.each(committed)("%s has no API key, token or signing secret", (file) => {
    const text = read(file)
    for (const pattern of [
      /SENDGRID_API_KEY\s*=\s*\S/,
      /BETTER_AUTH_SECRET\s*=\s*\S/,
      /AZURE_ARCHIVE_ACCOUNT_KEY\s*=\s*\S/,
      /CRON_SECRET\s*=\s*\S/,
      /\bSG\.[A-Za-z0-9_-]{10,}/, // a SendGrid key's literal shape
      /[A-Za-z0-9+/]{60,}={0,2}/, // a long base64 blob, e.g. an account key
    ]) {
      expect(text, `${file} matched ${pattern}`).not.toMatch(pattern)
    }
  })

  it.each(committed)(
    "%s marks its local credentials as placeholders",
    (file) => {
      const text = read(file)
      // Line-anchored, with [ \t] rather than \s after the `=`. `\s` matches a
      // NEWLINE, so an empty `REDIS_PASSWORD=` would otherwise consume the line
      // break and match the first non-space character of the NEXT line — which
      // is exactly how this test first reported base.env as holding a
      // credential it does not have.
      const hasCredential = /^\w*PASSWORD[ \t]*=[ \t]*\S/m.test(text)
      if (!hasCredential) return
      // A committed credential must be obviously local, so nobody mistakes it
      // for something that matters.
      expect(text).toMatch(/local-only-not-a-secret|minioadmin/)
    }
  )

  it("leaves REDIS_PASSWORD empty in the committed layers", () => {
    // Empty means "no auth", which suits a container that is not reachable
    // off-box. A real password would have to live in .env — and would have to
    // be repeated inside REDIS_URL, since ioredis takes credentials from the
    // URL, not from a separate variable.
    expect(read("base.env")).toMatch(/^REDIS_PASSWORD=$/m)
  })

  it("does not repeat v1's trust-model warning", () => {
    // No committed v2 file earns it, and leaving it in would teach the wrong
    // rule to the next person who adds a secret.
    const readme = read("README.md")
    expect(readme).not.toMatch(
      /repo read access ⇒|production root access\.\*\*/
    )
    // It explains the departure instead.
    expect(readme).toMatch(/does not inherit it/)
  })

  it("keeps the .env layer gitignored", () => {
    const ignored = execFileSync(
      "git",
      ["check-ignore", "-v", "docker/env/.env"],
      { cwd: REPO, encoding: "utf8" }
    )
    expect(ignored).toContain("docker/env/.env")
  })
})

describe("only local env files exist", () => {
  it("has no file describing a deployed environment", () => {
    const { readdirSync } = require("node:fs")
    const files = readdirSync(ENV_DIR).sort()
    expect(files).toEqual(["README.md", "base.env", "local.env"])
  })
})

describe("bucket names reflect packs, not flows", () => {
  it("defines S3_PACKS_BUCKET", () => {
    expect(loadEnv().S3_PACKS_BUCKET).toBe("praxis2-packs")
  })

  it("keeps S3_PUBLIC_BUCKET", () => {
    expect(loadEnv().S3_PUBLIC_BUCKET).toBe("praxis2-public")
  })

  it("mentions S3_FLOWS_BUCKET nowhere", () => {
    // §42 [changed]: a pack is more than its flows.
    for (const file of ["base.env", "local.env", "README.md"]) {
      expect(read(file)).not.toContain("S3_FLOWS_BUCKET")
    }
  })
})

describe("no display time zone is set globally", () => {
  it("pins no zone in any committed env file", () => {
    // §7 [changed]: the display zone is per market and per cohort, resolved by
    // the application. An environment-level default would be a second,
    // competing source of truth that silently wins.
    const env = loadEnv()
    expect(env.DISPLAY_TIMEZONE).toBeUndefined()
    expect(env.DEFAULT_TIMEZONE).toBeUndefined()
    for (const file of ["base.env", "local.env"]) {
      const text = read(file)
      // Mentioning the zones in a comment that explains the rule is fine;
      // assigning one is not.
      expect(text).not.toMatch(/^\s*TZ\s*=/m)
      expect(text).not.toMatch(/=\s*(Asia\/Kolkata|America\/New_York)\s*$/m)
    }
  })
})

describe("v2 cannot collide with a v1 stack", () => {
  it("publishes every port in a block distinct from v1's", () => {
    const env = loadEnv()
    // v1: 5432 / 3001 / 8080 / 4983 / 9000 / 9001 / 6379
    expect(env.POSTGRES_PORT).toBe("5433")
    expect(env.API_PORT).toBe("3002")
    expect(env.WEB_PORT).toBe("5174")
    expect(env.STUDIO_PORT).toBe("4984")
    expect(env.MINIO_PORT).toBe("9010")
    expect(env.MINIO_CONSOLE_PORT).toBe("9011")
    expect(env.REDIS_PORT).toBe("6380")
  })

  it("leaves §Layout's host dev ports free", () => {
    // api 3001 and web 5173 must stay available for a plain `pnpm dev`.
    const env = loadEnv()
    const published = [
      env.POSTGRES_PORT,
      env.API_PORT,
      env.WEB_PORT,
      env.STUDIO_PORT,
      env.MINIO_PORT,
      env.MINIO_CONSOLE_PORT,
      env.REDIS_PORT,
    ]
    expect(published).not.toContain("3001")
    expect(published).not.toContain("5173")
  })

  it("namespaces every Redis key", () => {
    // Cached entries hold whole API payloads keyed by user, so a shared
    // keyspace would be a cross-stack data leak, not just a stale read.
    expect(loadEnv().REDIS_KEY_PREFIX).toBe("praxis2:")
  })

  it("names the project, network and volumes praxis2", () => {
    const base = readFileSync(
      join(REPO, "docker", "docker-compose.yml"),
      "utf8"
    )
    expect(base).toMatch(/^name: praxis2$/m)
    expect(base).toMatch(/praxis2:\s*\n\s+driver: bridge/)
  })

  it("tags locally built images praxis2-*", () => {
    const local = readFileSync(
      join(REPO, "docker", "docker-compose.local.yml"),
      "utf8"
    )
    expect(local).toContain("image: praxis2-api:local")
    expect(local).toContain("image: praxis2-web:local")
  })
})

describe("no Swarm-only construct survives", () => {
  it("uses the bridge driver and no deploy: keys", () => {
    // An overlay network cannot be created without an initialised Swarm, so a
    // v1-shaped base file cannot be brought up with plain `docker compose up`.
    const { readdirSync } = require("node:fs")
    const files = readdirSync(join(REPO, "docker")).filter((f) =>
      f.endsWith(".yml")
    )
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(join(REPO, "docker", file), "utf8")
      expect(text, `${file}`).not.toMatch(/driver:\s*overlay/)
      expect(text, `${file}`).not.toMatch(/^\s{2,}deploy:\s*$/m)
    }
  })

  it("carries no remote-deployment script or overlay", () => {
    const { readdirSync } = require("node:fs")
    const entries = readdirSync(join(REPO, "docker"))
    for (const forbidden of [
      "remote-deploy.sh",
      "sync-remote.sh",
      "nginx.conf",
      "host-nginx.conf",
      "host-nginx.subpath.conf",
      "preview",
      "docker-compose.prod.yml",
      "docker-compose.dev.yml",
    ]) {
      expect(entries, `docker/${forbidden} should not exist`).not.toContain(
        forbidden
      )
    }
  })

  it("carries no claims-specific sync service", () => {
    const { readdirSync } = require("node:fs")
    for (const file of readdirSync(join(REPO, "docker")).filter((f) =>
      f.endsWith(".yml")
    )) {
      const text = readFileSync(join(REPO, "docker", file), "utf8")
      expect(text, file).not.toMatch(/^\s{2}sync:\s*$/m)
      expect(text, file).not.toContain("praxis-task sync")
    }
  })
})
