import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue({
        status: "ok",
        build: "test",
        buildTime: "2026-01-01T00:00:00.000Z",
        uptimeSeconds: 1,
      }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const { AppShell } = await import("@/app/AppShell")
const { HomePage } = await import("@/app/HomePage")
const { NotFoundPage } = await import("@/app/NotFoundPage")
const { router } = await import("@/app/router")
const { api } = await import("@/lib/api")

const HEALTH = {
  status: "ok",
  build: "test",
  buildTime: "2026-01-01T00:00:00.000Z",
  uptimeSeconds: 1,
}

/** Mount the real route tree at `path`, without touching window.history. */
function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
    { initialEntries: [path] }
  )
  return render(<RouterProvider router={memoryRouter} />)
}

beforeEach(() => {
  // clearAllMocks() clears recorded calls but KEEPS implementations, so a
  // pending promise set by one test would leak into the next. Re-establish the
  // default resolved value explicitly.
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue(HEALTH)
})

describe("the application shell", () => {
  it("renders the home route inside the shell", async () => {
    renderAt("/")

    expect(screen.getByText("Praxis")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Praxis v2" })
    ).toBeInTheDocument()
  })

  it("renders without a console error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    renderAt("/")
    await waitFor(() =>
      expect(screen.getByText("API status")).toBeInTheDocument()
    )

    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()

    consoleError.mockRestore()
    consoleWarn.mockRestore()
  })

  it("renders the not-found page for an unregistered route", () => {
    renderAt("/no-such-page")
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
  })
})

describe("the route registry", () => {
  it("registers its routes in app/router.tsx", () => {
    // §39 requires one registry. A route added elsewhere would not appear here.
    expect(router.routes).toHaveLength(1)
    expect(router.routes[0]?.children?.length).toBeGreaterThan(0)
  })
})

describe("SystemStatusCard", () => {
  it("shows a loading state before the response arrives", async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}))

    renderAt("/")
    // shadcn's CardTitle renders a div, not an h*, so there is no heading role
    // to query here — assert on the text.
    expect(screen.getByText("API status")).toBeVisible()
    // §39 makes a loading state mandatory, not optional polish.
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    )
  })

  it("renders the payload once loaded", async () => {
    renderAt("/")
    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument())
    expect(screen.getByText("test")).toBeInTheDocument()
  })

  it("renders the server's message as an alert when the request fails", async () => {
    const { ApiRequestError } = await import("@/lib/api")
    vi.mocked(api.get).mockRejectedValue(
      new ApiRequestError(503, { error: "The API is unavailable." })
    )

    renderAt("/")
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The API is unavailable."
      )
    )
  })
})

describe("the view layer's boundary", () => {
  it("does not import lib/api.ts", async () => {
    // §39: "views never call api.*". The import itself is the thing to catch —
    // a view that can reach the api will eventually call it.
    //
    // Read through process.cwd() (apps/web, where vitest runs) rather than
    // import.meta.url: under the jsdom environment that is an http:// URL, and
    // fileURLToPath rejects it with "The URL must be of scheme file".
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")

    const view = readFileSync(
      join(
        process.cwd(),
        "src/features/system-status/view/SystemStatusCard.tsx"
      ),
      "utf8"
    )

    expect(view).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(view).not.toContain("fetch(")
  })
})
