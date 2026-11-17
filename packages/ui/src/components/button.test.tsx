import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Button } from "./button"

describe("Button", () => {
  it("renders without crashing", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("renders with data-slot attribute", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-slot", "button")
  })

  // Variant tests
  it("applies default variant classes", () => {
    render(<Button variant="default">Default</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("data-variant", "default")
  })

  it("applies outline variant", () => {
    render(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-variant",
      "outline"
    )
  })

  it("applies secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-variant",
      "secondary"
    )
  })

  it("applies ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost")
  })

  it("applies destructive variant", () => {
    render(<Button variant="destructive">Destructive</Button>)
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-variant",
      "destructive"
    )
  })

  it("applies link variant", () => {
    render(<Button variant="link">Link</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "link")
  })

  // Size tests
  it("applies default size", () => {
    render(<Button size="default">Default</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "default")
  })

  it("applies xs size", () => {
    render(<Button size="xs">XS</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "xs")
  })

  it("applies sm size", () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "sm")
  })

  it("applies lg size", () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "lg")
  })

  it("applies icon size", () => {
    render(<Button size="icon">Icon</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "icon")
  })

  // Disabled state
  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("does not fire onClick when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Button disabled onClick={handler}>
        Disabled
      </Button>
    )
    await user.click(screen.getByRole("button"))
    expect(handler).not.toHaveBeenCalled()
  })

  // Click interaction
  it("fires onClick when clicked", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Button onClick={handler}>Click me</Button>)
    await user.click(screen.getByRole("button"))
    expect(handler).toHaveBeenCalledOnce()
  })

  // asChild
  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="#">Link button</a>
      </Button>
    )
    expect(
      screen.getByRole("link", { name: "Link button" })
    ).toBeInTheDocument()
  })

  // Custom className
  it("applies extra className", () => {
    render(<Button className="extra-class">Styled</Button>)
    expect(screen.getByRole("button")).toHaveClass("extra-class")
  })

  // Accessibility
  it("has correct button role", () => {
    render(<Button>Accessible</Button>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("is keyboard-operable via Enter", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Button onClick={handler}>Enter me</Button>)
    screen.getByRole("button").focus()
    await user.keyboard("{Enter}")
    expect(handler).toHaveBeenCalledOnce()
  })
})
