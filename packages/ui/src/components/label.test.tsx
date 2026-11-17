import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Label } from "./label"

describe("Label", () => {
  it("renders without crashing", () => {
    render(<Label>My label</Label>)
    expect(screen.getByText("My label")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Label>My label</Label>)
    expect(screen.getByText("My label")).toHaveAttribute("data-slot", "label")
  })

  it("associates with an input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="test-input">Email</Label>
        <input id="test-input" />
      </>
    )
    const label = screen.getByText("Email")
    expect(label).toHaveAttribute("for", "test-input")
  })

  it("applies extra className", () => {
    render(<Label className="extra">Label</Label>)
    expect(screen.getByText("Label")).toHaveClass("extra")
  })
})
