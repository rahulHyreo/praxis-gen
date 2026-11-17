import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, ApiRequestError } from "../api"

/**
 * `lib/api.ts` is the single point of API access for the whole app (§39), so
 * every request in every feature inherits whatever it does with credentials,
 * error envelopes and empty bodies. Testing it once here is worth more than
 * testing it per feature.
 *
 * `fetch` is replaced rather than the module: this IS the module under test.
 */
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("request construction", () => {
  it("prefixes every path with /api", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await api.get("/health")
    expect(fetchMock.mock.calls[0][0]).toBe("/api/health")
  })

  it("sends credentials, so a cookie session survives", async () => {
    // Sessions are cookie-based. Without this, a signed-in request is
    // anonymous and the failure looks like an auth bug.
    fetchMock.mockResolvedValue(jsonResponse({}))
    await api.get("/health")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: "include",
    })
  })

  it("uses a relative URL, so the dev proxy and same-origin serving both work", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await api.get("/health")
    const url = fetchMock.mock.calls[0][0] as string
    expect(url.startsWith("/")).toBe(true)
    expect(url).not.toMatch(/^https?:/)
  })

  it.each([
    ["get", "GET"],
    ["delete", "DELETE"],
  ] as const)("%s issues a %s with no body", async (method, verb) => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await api[method]("/thing")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe(verb)
    expect(init.body).toBeUndefined()
    // No Content-Type when there is nothing to describe.
    expect(init.headers).not.toMatchObject({
      "Content-Type": "application/json",
    })
  })

  it.each([
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
  ] as const)("%s serialises its body as JSON", async (method, verb) => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await api[method]("/thing", { a: 1 })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe(verb)
    expect(init.body).toBe('{"a":1}')
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
    })
  })

  it("allows a caller to add headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await api.get("/thing", { headers: { "X-Probe": "1" } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({ "X-Probe": "1" })
  })
})

describe("successful responses", () => {
  it("parses a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }))
    await expect(api.get("/health")).resolves.toEqual({ status: "ok" })
  })

  it("returns undefined for 204 No Content", async () => {
    // Parsing an empty body as JSON throws; a delete that returns 204 is
    // ordinary, so this must not be an error path.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.delete("/thing")).resolves.toBeUndefined()
  })

  it("returns undefined for a 200 with an empty body", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }))
    await expect(api.post("/thing")).resolves.toBeUndefined()
  })
})

describe("error responses", () => {
  it("throws ApiRequestError carrying the status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Nope" }, 400))
    await expect(api.get("/thing")).rejects.toBeInstanceOf(ApiRequestError)
    await expect(api.get("/thing")).rejects.toMatchObject({ status: 400 })
  })

  it("surfaces the server's message, code and details", async () => {
    // §12 requires a refusal reason to be rendered verbatim, so it has to
    // survive transport intact.
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: "Complete Week 4 before starting Week 5.",
          code: "block_locked",
          details: { week: 5 },
        },
        423
      )
    )
    await expect(api.get("/thing")).rejects.toMatchObject({
      message: "Complete Week 4 before starting Week 5.",
      code: "block_locked",
      details: { week: 5 },
      status: 423,
    })
  })

  it("survives a non-JSON error body", async () => {
    // A proxy error page or a gateway timeout does not send the §38 envelope.
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    )
    await expect(api.get("/thing")).rejects.toMatchObject({
      status: 502,
      message: "Request failed with status 502",
    })
  })

  it("survives a JSON body that is not an error envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }, 500))
    await expect(api.get("/thing")).rejects.toMatchObject({
      status: 500,
      message: "Request failed with status 500",
    })
  })

  it("falls back to a status message when the envelope's error is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "" }, 418))
    await expect(api.get("/thing")).rejects.toMatchObject({
      message: "Request failed with status 418",
    })
  })

  it("lets a transport failure propagate as-is", async () => {
    // An offline browser rejects fetch with a TypeError. Wrapping it in an
    // ApiRequestError would invent a status that never existed.
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(api.get("/thing")).rejects.toBeInstanceOf(TypeError)
  })

  it("names the error class, so it is identifiable in a log", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Nope" }, 400))
    await api.get("/thing").catch((err: unknown) => {
      expect((err as Error).name).toBe("ApiRequestError")
    })
  })
})
