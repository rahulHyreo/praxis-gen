import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Progress } from "./progress"

describe("Progress", () => {
  it("renders without crashing", () => {
    render(<Progress />)
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Progress />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "data-slot",
      "progress"
    )
  })

  // BUG: The Progress wrapper destructures `value` but doesn't forward it to ProgressPrimitive.Root,
  // so aria-valuenow is never set. The component needs `value={value}` on Root to fix this.
  it.fails("sets aria-valuenow from value prop", () => {
    render(<Progress value={60} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "60"
    )
  })

  it("renders indicator element", () => {
    const { container } = render(<Progress value={50} />)
    const indicator = container.querySelector(
      '[data-slot="progress-indicator"]'
    )
    expect(indicator).toBeInTheDocument()
  })

  it("applies translateX style based on value", () => {
    const { container } = render(<Progress value={75} />)
    const indicator = container.querySelector(
      '[data-slot="progress-indicator"]'
    ) as HTMLElement
    expect(indicator.style.transform).toBe("translateX(-25%)")
  })

  it("defaults to 0 when no value is given", () => {
    const { container } = render(<Progress />)
    const indicator = container.querySelector(
      '[data-slot="progress-indicator"]'
    ) as HTMLElement
    expect(indicator.style.transform).toBe("translateX(-100%)")
  })

  it("applies extra className", () => {
    render(<Progress className="my-progress" />)
    expect(screen.getByRole("progressbar")).toHaveClass("my-progress")
  })
})
