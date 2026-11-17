import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Textarea } from "./textarea"

describe("Textarea", () => {
  it("renders without crashing", () => {
    render(<Textarea />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Textarea />)
    expect(screen.getByRole("textbox")).toHaveAttribute("data-slot", "textarea")
  })

  it("accepts a placeholder", () => {
    render(<Textarea placeholder="Write here..." />)
    expect(screen.getByPlaceholderText("Write here...")).toBeInTheDocument()
  })

  it("accepts typed input", async () => {
    const { user } = renderWithUser(<Textarea />)
    const ta = screen.getByRole("textbox")
    await user.type(ta, "hello world")
    expect(ta).toHaveValue("hello world")
  })

  it("calls onChange handler", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Textarea onChange={handler} />)
    await user.type(screen.getByRole("textbox"), "x")
    expect(handler).toHaveBeenCalled()
  })

  it("is disabled when disabled prop is set", () => {
    render(<Textarea disabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  it("accepts aria-invalid for validation state", () => {
    render(<Textarea aria-invalid="true" />)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
  })

  it("applies extra className", () => {
    render(<Textarea className="custom-ta" />)
    expect(screen.getByRole("textbox")).toHaveClass("custom-ta")
  })
})
