import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScrollArea, ScrollBar } from "./scroll-area"

describe("ScrollArea", () => {
  it("renders without crashing", () => {
    render(<ScrollArea>content</ScrollArea>)
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  it("has data-slot on root", () => {
    const { container } = render(<ScrollArea>content</ScrollArea>)
    expect(
      container.querySelector('[data-slot="scroll-area"]')
    ).toBeInTheDocument()
  })

  it("has viewport element", () => {
    const { container } = render(<ScrollArea>content</ScrollArea>)
    expect(
      container.querySelector('[data-slot="scroll-area-viewport"]')
    ).toBeInTheDocument()
  })

  // Radix ScrollArea type="always" forces scrollbar to render regardless of overflow
  it("renders vertical scrollbar by default", () => {
    const { container } = render(<ScrollArea type="always">content</ScrollArea>)
    const scrollbar = container.querySelector(
      '[data-slot="scroll-area-scrollbar"]'
    )
    expect(scrollbar).toBeInTheDocument()
    expect(scrollbar).toHaveAttribute("data-orientation", "vertical")
  })

  it("renders horizontal scrollbar when orientation=horizontal", () => {
    const { container } = render(
      <ScrollArea type="always" orientation="horizontal">
        content
      </ScrollArea>
    )
    const scrollbar = container.querySelector(
      '[data-slot="scroll-area-scrollbar"]'
    )
    expect(scrollbar).toHaveAttribute("data-orientation", "horizontal")
  })

  it("renders both scrollbars when orientation=both", () => {
    const { container } = render(
      <ScrollArea type="always" orientation="both">
        content
      </ScrollArea>
    )
    const scrollbars = container.querySelectorAll(
      '[data-slot="scroll-area-scrollbar"]'
    )
    expect(scrollbars).toHaveLength(2)
  })

  it("applies extra className", () => {
    const { container } = render(
      <ScrollArea className="my-scroll">content</ScrollArea>
    )
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveClass(
      "my-scroll"
    )
  })
})

describe("ScrollBar", () => {
  it("renders without crashing", () => {
    // ScrollBar must be inside a ScrollArea context — use the full ScrollArea wrapper
    const { container } = render(
      <ScrollArea type="always">
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    )
    expect(
      container.querySelector('[data-slot="scroll-area-scrollbar"]')
    ).toBeInTheDocument()
  })
})
