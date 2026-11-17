import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Toggle } from "./toggle"

describe("Toggle", () => {
  it("renders without crashing", () => {
    render(<Toggle>Bold</Toggle>)
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Toggle>Bold</Toggle>)
    expect(screen.getByRole("button")).toHaveAttribute("data-slot", "toggle")
  })

  it("is not pressed by default", () => {
    render(<Toggle>Bold</Toggle>)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
  })

  it("becomes pressed when clicked", async () => {
    const { user } = renderWithUser(<Toggle>Bold</Toggle>)
    const btn = screen.getByRole("button")
    await user.click(btn)
    expect(btn).toHaveAttribute("aria-pressed", "true")
  })

  it("toggles back to unpressed on second click", async () => {
    const { user } = renderWithUser(<Toggle>Bold</Toggle>)
    const btn = screen.getByRole("button")
    await user.click(btn)
    await user.click(btn)
    expect(btn).toHaveAttribute("aria-pressed", "false")
  })

  it("calls onPressedChange handler", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Toggle onPressedChange={handler}>Bold</Toggle>
    )
    await user.click(screen.getByRole("button"))
    expect(handler).toHaveBeenCalledWith(true)
  })

  it("applies default variant", () => {
    render(<Toggle variant="default">B</Toggle>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("applies outline variant", () => {
    render(<Toggle variant="outline">B</Toggle>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("applies sm size", () => {
    render(<Toggle size="sm">B</Toggle>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("applies lg size", () => {
    render(<Toggle size="lg">B</Toggle>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("is disabled when disabled prop is set", () => {
    render(<Toggle disabled>Bold</Toggle>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("does not toggle when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Toggle disabled onPressedChange={handler}>
        Bold
      </Toggle>
    )
    await user.click(screen.getByRole("button"))
    expect(handler).not.toHaveBeenCalled()
  })

  it("respects controlled pressed state", () => {
    render(<Toggle pressed={true}>Bold</Toggle>)
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  })

  it("accepts extra className", () => {
    render(<Toggle className="extra">Bold</Toggle>)
    expect(screen.getByRole("button")).toHaveClass("extra")
  })
})
