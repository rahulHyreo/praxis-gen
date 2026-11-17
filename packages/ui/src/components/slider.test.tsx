import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Slider } from "./slider"

describe("Slider", () => {
  it("renders without crashing", () => {
    const { container } = render(<Slider />)
    expect(container.querySelector('[data-slot="slider"]')).toBeInTheDocument()
  })

  it("has data-slot attribute on the root", () => {
    const { container } = render(<Slider />)
    expect(container.querySelector('[data-slot="slider"]')).toHaveAttribute(
      "data-slot",
      "slider"
    )
  })

  it("renders the track and range", () => {
    const { container } = render(<Slider />)
    expect(
      container.querySelector('[data-slot="slider-track"]')
    ).toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="slider-range"]')
    ).toBeInTheDocument()
  })

  it("renders a thumb when no value is provided", () => {
    render(<Slider />)
    expect(screen.getAllByRole("slider").length).toBeGreaterThanOrEqual(1)
  })

  it("renders a single thumb for a single-value defaultValue", () => {
    render(<Slider defaultValue={[50]} />)
    expect(screen.getAllByRole("slider")).toHaveLength(1)
  })

  it("renders multiple thumbs for a multi-value defaultValue", () => {
    render(<Slider defaultValue={[20, 40, 60]} />)
    expect(screen.getAllByRole("slider")).toHaveLength(3)
  })

  it("renders thumbs for a controlled array value", () => {
    render(<Slider value={[25, 75]} onValueChange={() => {}} />)
    expect(screen.getAllByRole("slider")).toHaveLength(2)
  })

  it("reflects the controlled value on the thumb", () => {
    render(<Slider value={[30]} onValueChange={() => {}} />)
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "30")
  })

  it("respects custom min and max", () => {
    render(<Slider defaultValue={[5]} min={0} max={10} />)
    const thumb = screen.getByRole("slider")
    expect(thumb).toHaveAttribute("aria-valuemin", "0")
    expect(thumb).toHaveAttribute("aria-valuemax", "10")
  })

  it("changes value with arrow keys", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Slider defaultValue={[50]} onValueChange={handler} />
    )
    screen.getByRole("slider").focus()
    await user.keyboard("{ArrowRight}")
    expect(handler).toHaveBeenCalledWith([51])
  })

  it("does not respond to keyboard when disabled", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Slider defaultValue={[50]} disabled onValueChange={handler} />
    )
    await user.keyboard("{ArrowRight}")
    expect(handler).not.toHaveBeenCalled()
  })

  it("applies a disabled data attribute", () => {
    const { container } = render(<Slider defaultValue={[50]} disabled />)
    expect(container.querySelector('[data-slot="slider"]')).toHaveAttribute(
      "data-disabled"
    )
  })

  it("supports vertical orientation", () => {
    render(<Slider defaultValue={[50]} orientation="vertical" />)
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-orientation",
      "vertical"
    )
  })

  it("merges a custom className on the root", () => {
    const { container } = render(<Slider className="custom-slider" />)
    expect(container.querySelector('[data-slot="slider"]')).toHaveClass(
      "custom-slider"
    )
  })

  it("renders a focusable thumb", () => {
    render(<Slider defaultValue={[50]} />)
    expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "0")
  })
})
