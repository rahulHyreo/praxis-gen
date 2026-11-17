import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Input } from "./input"

describe("Input", () => {
  it("renders without crashing", () => {
    render(<Input />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Input />)
    expect(screen.getByRole("textbox")).toHaveAttribute("data-slot", "input")
  })

  it("accepts a placeholder", () => {
    render(<Input placeholder="Enter text..." />)
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument()
  })

  it("accepts typed input", async () => {
    const { user } = renderWithUser(<Input />)
    const input = screen.getByRole("textbox")
    await user.type(input, "hello")
    expect(input).toHaveValue("hello")
  })

  it("calls onChange handler", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Input onChange={handler} />)
    await user.type(screen.getByRole("textbox"), "a")
    expect(handler).toHaveBeenCalled()
  })

  it("is disabled when disabled prop is set", () => {
    render(<Input disabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  it("does not accept input when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Input disabled onChange={handler} />)
    await user.type(screen.getByRole("textbox"), "abc")
    expect(handler).not.toHaveBeenCalled()
  })

  it("renders with type=email", () => {
    render(<Input type="email" />)
    // email inputs don't have a generic "textbox" role in jsdom - use container query
    const input = document.querySelector('input[type="email"]')
    expect(input).toBeInTheDocument()
  })

  it("renders with type=password", () => {
    render(<Input type="password" />)
    const input = document.querySelector('input[type="password"]')
    expect(input).toBeInTheDocument()
  })

  it("accepts aria-invalid attribute for validation state", () => {
    render(<Input aria-invalid="true" />)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
  })

  it("applies extra className", () => {
    render(<Input className="custom" />)
    expect(screen.getByRole("textbox")).toHaveClass("custom")
  })

  it("forwards ref-compatible props like id", () => {
    render(<Input id="my-input" />)
    expect(document.getElementById("my-input")).toBeInTheDocument()
  })
})
