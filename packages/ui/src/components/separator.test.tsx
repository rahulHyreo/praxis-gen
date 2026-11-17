import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Separator } from "./separator"

describe("Separator", () => {
  it("renders without crashing", () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toHaveAttribute("data-slot", "separator")
  })

  it("defaults to horizontal orientation", () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toHaveAttribute(
      "data-orientation",
      "horizontal"
    )
  })

  it("renders vertical orientation", () => {
    const { container } = render(<Separator orientation="vertical" />)
    expect(container.firstChild).toHaveAttribute("data-orientation", "vertical")
  })

  it("is decorative by default (no role)", () => {
    const { container } = render(<Separator />)
    // decorative=true means no role="separator" in the DOM
    expect(container.firstChild).not.toHaveAttribute("role", "separator")
  })

  it("has role=separator when decorative=false", () => {
    const { container } = render(<Separator decorative={false} />)
    expect(container.firstChild).toHaveAttribute("role", "separator")
  })

  it("applies extra className", () => {
    const { container } = render(<Separator className="my-sep" />)
    expect(container.firstChild).toHaveClass("my-sep")
  })
})
