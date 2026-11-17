import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"

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

const { api } = await import("@/lib/api")
const { App } = await import("@/App")

/**
 * The root composition, rendered through its real browser router rather than a
 * memory router — so this covers what `main.tsx` actually mounts. The route
 * tree itself is tested in ./shell.test.tsx; what matters here is that the
 * providers wrap it.
 */
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({
    status: "ok",
    build: "test",
    buildTime: "2026-01-01T00:00:00.000Z",
    uptimeSeconds: 1,
  })
  window.history.pushState({}, "", "/")
})

describe("App", () => {
  it("renders the router at the current location", async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Praxis v2" })).toBeVisible()
    )
  })

  it("mounts a working Sonner toaster", async () => {
    // §39 fixes Sonner as the one notification mechanism, and a feature that
    // calls toast() with no toaster mounted fails SILENTLY — nothing renders
    // and nothing throws. So this asserts the behaviour rather than probing for
    // a `[data-sonner-toaster]` attribute, which sonner does not reliably
    // inject under jsdom (v1's own sonner test records the same caveat).
    const { toast } = await import("sonner")
    render(<App />)

    act(() => {
      toast("Saved")
    })

    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument())
  })

  it("renders without a console error or warning", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(<App />)
    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument())

    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()

    consoleError.mockRestore()
    consoleWarn.mockRestore()
  })
})
