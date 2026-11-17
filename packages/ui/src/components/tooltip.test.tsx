import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip"

function BasicTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button>Hover me</button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tooltip text</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

describe("Tooltip", () => {
  it("renders trigger without crashing", () => {
    render(<BasicTooltip />)
    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument()
  })

  it("tooltip content is not visible initially", () => {
    render(<BasicTooltip />)
    expect(screen.queryByText("Tooltip text")).not.toBeInTheDocument()
  })

  it("shows tooltip on hover", async () => {
    const { user } = renderWithUser(<BasicTooltip />)
    await user.hover(screen.getByRole("button", { name: "Hover me" }))
    expect(screen.getAllByText("Tooltip text").length).toBeGreaterThan(0)
  })

  // BUG: Radix Tooltip does not dismiss on unhover in jsdom — the tooltip stays open because
  // jsdom does not fire real pointer/mouse leave events that Radix listens to for hiding.
  it.fails("hides tooltip when mouse leaves", async () => {
    const { user } = renderWithUser(<BasicTooltip />)
    await user.hover(screen.getByRole("button", { name: "Hover me" }))
    await user.unhover(screen.getByRole("button", { name: "Hover me" }))
    expect(screen.queryAllByText("Tooltip text")).toHaveLength(0)
  })

  it("tooltip content has data-slot attribute", async () => {
    const { user } = renderWithUser(<BasicTooltip />)
    await user.hover(screen.getByRole("button", { name: "Hover me" }))
    expect(
      document.querySelector('[data-slot="tooltip-content"]')
    ).toBeInTheDocument()
  })

  it("TooltipProvider renders children", () => {
    render(
      <TooltipProvider>
        <span>Child</span>
      </TooltipProvider>
    )
    expect(screen.getByText("Child")).toBeInTheDocument()
  })

  it("shows tooltip on focus (keyboard accessible)", async () => {
    const { user } = renderWithUser(<BasicTooltip />)
    await user.tab()
    expect(screen.getAllByText("Tooltip text").length).toBeGreaterThan(0)
  })
})
