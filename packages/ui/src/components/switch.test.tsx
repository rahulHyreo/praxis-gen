import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Switch } from "./switch"

describe("Switch", () => {
  it("renders without crashing", () => {
    render(<Switch />)
    expect(screen.getByRole("switch")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Switch />)
    expect(screen.getByRole("switch")).toHaveAttribute("data-slot", "switch")
  })

  it("is off by default", () => {
    render(<Switch />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false")
  })

  it("turns on when clicked", async () => {
    const { user } = renderWithUser(<Switch />)
    await user.click(screen.getByRole("switch"))
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("turns off on second click", async () => {
    const { user } = renderWithUser(<Switch />)
    const sw = screen.getByRole("switch")
    await user.click(sw)
    await user.click(sw)
    expect(sw).toHaveAttribute("aria-checked", "false")
  })

  it("calls onCheckedChange handler", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Switch onCheckedChange={handler} />)
    await user.click(screen.getByRole("switch"))
    expect(handler).toHaveBeenCalledWith(true)
  })

  it("is disabled when disabled prop is set", () => {
    render(<Switch disabled />)
    expect(screen.getByRole("switch")).toBeDisabled()
  })

  it("does not toggle when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Switch disabled onCheckedChange={handler} />
    )
    await user.click(screen.getByRole("switch"))
    expect(handler).not.toHaveBeenCalled()
  })

  it("applies default size", () => {
    render(<Switch size="default" />)
    expect(screen.getByRole("switch")).toHaveAttribute("data-size", "default")
  })

  it("applies sm size", () => {
    render(<Switch size="sm" />)
    expect(screen.getByRole("switch")).toHaveAttribute("data-size", "sm")
  })

  it("renders in controlled checked state", () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("is keyboard accessible via Space", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Switch onCheckedChange={handler} />)
    screen.getByRole("switch").focus()
    await user.keyboard(" ")
    expect(handler).toHaveBeenCalledWith(true)
  })

  it("accepts aria-label", () => {
    render(<Switch aria-label="Enable notifications" />)
    expect(
      screen.getByRole("switch", { name: "Enable notifications" })
    ).toBeInTheDocument()
  })

  it("has a thumb element", () => {
    const { container } = render(<Switch />)
    expect(
      container.querySelector('[data-slot="switch-thumb"]')
    ).toBeInTheDocument()
  })
})
