import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { RadioGroup, RadioGroupItem } from "./radio-group"

function renderGroup(props?: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup {...props}>
      <RadioGroupItem value="a" aria-label="Option A" />
      <RadioGroupItem value="b" aria-label="Option B" />
    </RadioGroup>
  )
}

describe("RadioGroup", () => {
  it("renders without crashing", () => {
    render(renderGroup())
    expect(screen.getByRole("radiogroup")).toBeInTheDocument()
  })

  it("has data-slot attribute on the group", () => {
    render(renderGroup())
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-slot",
      "radio-group"
    )
  })

  it("renders its items as radios", () => {
    render(renderGroup())
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("has data-slot attribute on each item", () => {
    render(renderGroup())
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "data-slot",
      "radio-group-item"
    )
  })

  it("selects an item when clicked", async () => {
    const { user } = renderWithUser(renderGroup())
    await user.click(screen.getByRole("radio", { name: "Option A" }))
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("calls onValueChange with the selected value", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(renderGroup({ onValueChange: handler }))
    await user.click(screen.getByRole("radio", { name: "Option B" }))
    expect(handler).toHaveBeenCalledWith("b")
  })

  it("only one item is checked at a time", async () => {
    const { user } = renderWithUser(renderGroup())
    await user.click(screen.getByRole("radio", { name: "Option A" }))
    await user.click(screen.getByRole("radio", { name: "Option B" }))
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "aria-checked",
      "false"
    )
    expect(screen.getByRole("radio", { name: "Option B" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("respects defaultValue", () => {
    render(renderGroup({ defaultValue: "b" }))
    expect(screen.getByRole("radio", { name: "Option B" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("renders in a controlled checked state", () => {
    render(renderGroup({ value: "a", onValueChange: () => {} }))
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("does not select a disabled item", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <RadioGroup onValueChange={handler}>
        <RadioGroupItem value="a" aria-label="Option A" disabled />
      </RadioGroup>
    )
    await user.click(screen.getByRole("radio", { name: "Option A" }))
    expect(handler).not.toHaveBeenCalled()
  })

  it("merges a custom className on the group", () => {
    render(renderGroup({ className: "custom-group" }))
    expect(screen.getByRole("radiogroup")).toHaveClass("custom-group")
  })

  it("merges a custom className on an item", () => {
    render(
      <RadioGroup>
        <RadioGroupItem
          value="a"
          aria-label="Option A"
          className="custom-item"
        />
      </RadioGroup>
    )
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveClass(
      "custom-item"
    )
  })

  it("renders the indicator for the checked item", () => {
    const { container } = render(renderGroup({ defaultValue: "a" }))
    expect(
      container.querySelector('[data-slot="radio-group-indicator"]')
    ).toBeInTheDocument()
  })
})
