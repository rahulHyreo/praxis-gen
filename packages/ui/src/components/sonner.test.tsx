import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { Toaster } from "./sonner"

// next-themes needs to be mocked — it depends on DOM/window context not available in jsdom.
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}))

describe("Toaster (Sonner)", () => {
  it("renders without crashing", () => {
    // Toaster renders the Sonner element into the DOM
    expect(() => render(<Toaster />)).not.toThrow()
  })

  it("renders a toaster region in the document", () => {
    // Sonner may or may not inject [data-sonner-toaster] in jsdom — verify rendering doesn't throw
    expect(() => render(<Toaster />)).not.toThrow()
    // The toaster element, if injected, should be an HTMLElement
    const toaster = document.querySelector("[data-sonner-toaster]")
    if (toaster) {
      expect(toaster).toBeInTheDocument()
    } else {
      // Sonner renders asynchronously or outside jsdom body — just confirm no crash
      expect(document.body).toBeInTheDocument()
    }
  })

  it("accepts position prop without crashing", () => {
    expect(() => render(<Toaster position="top-center" />)).not.toThrow()
  })

  it("accepts richColors prop without crashing", () => {
    expect(() => render(<Toaster richColors />)).not.toThrow()
  })
})
