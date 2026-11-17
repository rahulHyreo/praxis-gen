import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import express from "express"
import request from "supertest"
import { z } from "zod"

import { createServer } from "../server.js"
import {
  errorHandler,
  notFoundHandler,
  type ApiError,
} from "../middleware/error.middleware.js"

describe("GET /api/health", () => {
  it("answers 200 with no database configured", async () => {
    // §44: the container healthcheck waits on this endpoint, so it must not
    // depend on Postgres. If it did, a slow database would look like a failed
    // deploy and the stack would never report healthy.
    const previous = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const res = await request(createServer()).get("/api/health")
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ status: "ok" })
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous
    }
  })

  it("reports a build identity and uptime", async () => {
    const res = await request(createServer()).get("/api/health")
    expect(typeof res.body.build).toBe("string")
    expect(typeof res.body.buildTime).toBe("string")
    expect(typeof res.body.uptimeSeconds).toBe("number")
  })

  it("requires no authentication", async () => {
    // No cookie, no header.
    const res = await request(createServer()).get("/api/health")
    expect(res.status).toBe(200)
  })
})

describe("unmatched /api paths", () => {
  it("return the §38 error envelope, not Express's HTML page", async () => {
    const res = await request(createServer()).get("/api/does-not-exist")
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty("error")
    expect(res.headers["content-type"]).toMatch(/json/)
  })

  it("name the method and path", async () => {
    const res = await request(createServer()).post("/api/nope")
    expect(res.body.error).toContain("POST")
    expect(res.body.error).toContain("/nope")
  })
})

/**
 * The async-error contract.
 *
 * `express-async-errors` is imported first in ../server.ts. Without it, Express
 * 4 drops a rejected promise from an async handler: the request HANGS until the
 * client times out and nothing is logged. These tests assert the observable
 * consequence — a thrown error becomes a response — because that is the only
 * way the patch's absence would be noticed.
 */
describe("async error forwarding", () => {
  function appWithRoute(handler: express.RequestHandler): express.Express {
    const app = express()
    app.use(express.json())
    app.get("/boom", handler)
    app.use("/", notFoundHandler)
    app.use(errorHandler)
    return app
  }

  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // The handler logs every 5xx by design; keep the test output readable
    // while still asserting it logged (below).
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it("turns a rejected async handler into a 500 response, not a hung request", async () => {
    const app = appWithRoute(async () => {
      throw new Error("kaboom")
    })
    const res = await request(app).get("/boom")
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty("error")
  })

  it("logs a 5xx with its method and path", async () => {
    const app = appWithRoute(async () => {
      throw new Error("kaboom")
    })
    await request(app).get("/boom")
    expect(consoleError).toHaveBeenCalled()
    const logged = consoleError.mock.calls.map((c) => String(c[0])).join(" ")
    expect(logged).toContain("GET")
    expect(logged).toContain("/boom")
  })

  it("does not leak an internal exception message to the client", async () => {
    // A 5xx message can carry a query, a path or a connection string.
    const app = appWithRoute(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432 for user postgres")
    })
    const res = await request(app).get("/boom")
    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Internal server error")
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED")
    expect(JSON.stringify(res.body)).not.toContain("5432")
  })

  it("honours a deliberate sub-500 status, message, code and details", async () => {
    const app = appWithRoute(async () => {
      const err: ApiError = Object.assign(new Error("Nope"), {
        status: 409,
        code: "some_conflict",
        details: { field: "name" },
      })
      throw err
    })
    const res = await request(app).get("/boom")
    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      error: "Nope",
      code: "some_conflict",
      details: { field: "name" },
    })
  })

  it("omits details and code when the route supplies neither", async () => {
    const app = appWithRoute(async () => {
      const err: ApiError = Object.assign(new Error("Plain"), { status: 400 })
      throw err
    })
    const res = await request(app).get("/boom")
    expect(res.body).toEqual({ error: "Plain" })
  })
})

describe("ZodError mapping", () => {
  function appThrowing(err: unknown): express.Express {
    const app = express()
    app.get("/v", () => {
      throw err
    })
    app.use(errorHandler)
    return app
  }

  it("maps a ZodError to 422, not 400", async () => {
    // §38 requires 422: the request was understood and refused, which is what
    // 422 means. 400 would conflate it with a malformed request.
    const schema = z.object({ email: z.string().email() })
    const parsed = schema.safeParse({ email: "nope" })
    expect(parsed.success).toBe(false)

    const res = await request(appThrowing(parsed.error)).get("/v")
    expect(res.status).toBe(422)
  })

  it("returns the issues in details with the shared code", async () => {
    const schema = z.object({ age: z.number() })
    const parsed = schema.safeParse({ age: "old" })
    const res = await request(appThrowing(parsed.error)).get("/v")

    expect(res.body.error).toBe("Validation failed")
    expect(res.body.code).toBe("VALIDATION_FAILED")
    expect(Array.isArray(res.body.details)).toBe(true)
    expect(res.body.details.length).toBeGreaterThan(0)
  })

  it("maps a ZodError thrown from an async handler too", async () => {
    const schema = z.object({ name: z.string() })
    const app = express()
    app.get("/v", async () => {
      schema.parse({})
    })
    app.use(errorHandler)

    const res = await request(app).get("/v")
    expect(res.status).toBe(422)
    expect(res.body.code).toBe("VALIDATION_FAILED")
  })
})

describe("middleware order", () => {
  it("registers the error handler with four parameters", () => {
    // Express identifies an error handler by arity. A three-parameter version
    // is silently treated as ordinary middleware and never runs for an error.
    expect(errorHandler.length).toBe(4)
  })

  it("parses a JSON body before the routes see it", async () => {
    const app = express()
    app.use(express.json())
    app.post("/echo", (req, res) => {
      res.json({ got: req.body })
    })
    const res = await request(app).post("/echo").send({ a: 1 })
    expect(res.body.got).toEqual({ a: 1 })
  })
})
