import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./collapsible"

function BasicCollapsible({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger>
        <span>Toggle</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p>Hidden content</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

describe("Collapsible", () => {
  it("renders without crashing", () => {
    render(<BasicCollapsible />)
    expect(screen.getByText("Toggle")).toBeInTheDocument()
  })

  it("has data-slot on root", () => {
    const { container } = render(<BasicCollapsible />)
    expect(
      container.querySelector('[data-slot="collapsible"]')
    ).toBeInTheDocument()
  })

  it("content is hidden by default", () => {
    render(<BasicCollapsible />)
    // Radix CollapsibleContent is not rendered when closed
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument()
  })

  it("shows content when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicCollapsible />)
    await user.click(screen.getByText("Toggle"))
    expect(screen.getByText("Hidden content")).toBeInTheDocument()
  })

  it("hides content on second click", async () => {
    const { user } = renderWithUser(<BasicCollapsible />)
    await user.click(screen.getByText("Toggle"))
    await user.click(screen.getByText("Toggle"))
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument()
  })

  it("starts open when defaultOpen=true", () => {
    render(<BasicCollapsible defaultOpen />)
    expect(screen.getByText("Hidden content")).toBeInTheDocument()
  })

  it("has data-slot on trigger", () => {
    const { container } = render(<BasicCollapsible />)
    expect(
      container.querySelector('[data-slot="collapsible-trigger"]')
    ).toBeInTheDocument()
  })

  it("has data-slot on content", () => {
    const { container } = render(<BasicCollapsible defaultOpen />)
    expect(
      container.querySelector('[data-slot="collapsible-content"]')
    ).toBeInTheDocument()
  })
})
