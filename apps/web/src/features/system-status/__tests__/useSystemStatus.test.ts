import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

// §43: no network in a web test. Mocking this ONE module is what routing every
// request through lib/api.ts buys — a `fetch` inside a component could not be
// replaced without rendering the network.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const { api, ApiRequestError } = await import("@/lib/api")
const { useSystemStatus } = await import("../viewmodel/useSystemStatus")

const get = vi.mocked(api.get)

const HEALTH = {
  status: "ok",
  build: "dev",
  buildTime: "unknown",
  uptimeSeconds: 12,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useSystemStatus", () => {
  it("starts in the loading state", () => {
    get.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSystemStatus())

    expect(result.current.loading).toBe(true)
    expect(result.current.health).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("exposes the parsed payload once resolved", async () => {
    get.mockResolvedValue(HEALTH)
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.health).toEqual(HEALTH)
    expect(result.current.error).toBeNull()
  })

  it("requests the health endpoint", async () => {
    get.mockResolvedValue(HEALTH)
    renderHook(() => useSystemStatus())

    await waitFor(() => expect(get).toHaveBeenCalledWith("/health"))
  })

  it("surfaces the server's own message for a refused request", async () => {
    // §12 requires the server's reason to be rendered verbatim, so the
    // viewmodel must not replace it with wording of its own.
    get.mockRejectedValue(
      new ApiRequestError(423, {
        error: "Complete Week 4 before starting Week 5.",
        code: "block_locked",
      })
    )
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Complete Week 4 before starting Week 5.")
    expect(result.current.health).toBeNull()
  })

  it("reports a transport failure without a server message", async () => {
    get.mockRejectedValue(new TypeError("Failed to fetch"))
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Failed to fetch")
  })

  it("falls back to a readable message for a non-Error rejection", async () => {
    get.mockRejectedValue("nope")
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Could not reach the API.")
  })

  it("reports a malformed payload as an error rather than passing it through", async () => {
    // Parsing at the boundary is the point: a shape change becomes one clear
    // error here instead of `undefined` inside a view.
    get.mockResolvedValue({ status: "ok" })
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBeNull()
    expect(result.current.health).toBeNull()
  })

  it("refetches on reload and clears a previous error", async () => {
    get.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(HEALTH)
    const { result } = renderHook(() => useSystemStatus())

    await waitFor(() => expect(result.current.error).toBe("boom"))

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.health).toEqual(HEALTH)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it("ignores a response that arrives after unmount", async () => {
    let resolve: (value: unknown) => void = () => {}
    get.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const { unmount } = renderHook(() => useSystemStatus())
    unmount()

    // Setting state after unmount is the classic React warning; the hook's
    // `active` flag is what prevents it.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    await act(async () => {
      resolve(HEALTH)
    })
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
