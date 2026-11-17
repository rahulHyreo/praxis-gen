import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

describe("ToggleGroup", () => {
  it("renders without crashing", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(screen.getByRole("group")).toBeInTheDocument()
  })

  it("has data-slot on root", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(
      document.querySelector('[data-slot="toggle-group"]')
    ).toBeInTheDocument()
  })

  it("renders all items", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(screen.getByRole("radio", { name: "Bold" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Italic" })).toBeInTheDocument()
  })

  it("single type: selects item on click", async () => {
    const { user } = renderWithUser(
      <ToggleGroup type="single">
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>
    )
    await user.click(screen.getByRole("radio", { name: "Bold" }))
    expect(screen.getByRole("radio", { name: "Bold" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("multiple type: selects multiple items", async () => {
    const { user } = renderWithUser(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>
    )
    await user.click(screen.getByRole("button", { name: "Bold" }))
    await user.click(screen.getByRole("button", { name: "Italic" }))
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("calls onValueChange for single type", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <ToggleGroup type="single" onValueChange={handler}>
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      </ToggleGroup>
    )
    await user.click(screen.getByRole("radio", { name: "Bold" }))
    expect(handler).toHaveBeenCalledWith("bold")
  })

  it("applies variant to items via context", () => {
    render(
      <ToggleGroup type="single" variant="outline">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(
      document.querySelector('[data-slot="toggle-group-item"]')
    ).toHaveAttribute("data-variant", "outline")
  })

  it("applies size to items via context", () => {
    render(
      <ToggleGroup type="single" size="sm">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(
      document.querySelector('[data-slot="toggle-group-item"]')
    ).toHaveAttribute("data-size", "sm")
  })
})
