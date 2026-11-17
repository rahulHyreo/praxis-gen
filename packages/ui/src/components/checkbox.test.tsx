import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Checkbox } from "./checkbox"

describe("Checkbox", () => {
  it("renders without crashing", () => {
    render(<Checkbox />)
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Checkbox />)
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-slot",
      "checkbox"
    )
  })

  it("is unchecked by default", () => {
    render(<Checkbox />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("checks when clicked", async () => {
    const { user } = renderWithUser(<Checkbox />)
    const cb = screen.getByRole("checkbox")
    await user.click(cb)
    expect(cb).toBeChecked()
  })

  it("unchecks on second click", async () => {
    const { user } = renderWithUser(<Checkbox />)
    const cb = screen.getByRole("checkbox")
    await user.click(cb)
    await user.click(cb)
    expect(cb).not.toBeChecked()
  })

  it("calls onCheckedChange when toggled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Checkbox onCheckedChange={handler} />)
    await user.click(screen.getByRole("checkbox"))
    expect(handler).toHaveBeenCalledWith(true)
  })

  it("is disabled when disabled prop is set", () => {
    render(<Checkbox disabled />)
    expect(screen.getByRole("checkbox")).toBeDisabled()
  })

  it("does not toggle when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Checkbox disabled onCheckedChange={handler} />
    )
    await user.click(screen.getByRole("checkbox"))
    expect(handler).not.toHaveBeenCalled()
  })

  it("renders in controlled checked state", () => {
    render(<Checkbox checked={true} onCheckedChange={() => {}} />)
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("is keyboard accessible via Space", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<Checkbox onCheckedChange={handler} />)
    screen.getByRole("checkbox").focus()
    await user.keyboard(" ")
    expect(handler).toHaveBeenCalledWith(true)
  })

  it("accepts aria-label for accessibility", () => {
    render(<Checkbox aria-label="Accept terms" />)
    expect(
      screen.getByRole("checkbox", { name: "Accept terms" })
    ).toBeInTheDocument()
  })

  it("applies extra className", () => {
    render(<Checkbox className="extra" />)
    expect(screen.getByRole("checkbox")).toHaveClass("extra")
  })
})
