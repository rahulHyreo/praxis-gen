import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverAnchor,
} from "./popover"

function BasicPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button>Open Popover</button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Title</PopoverTitle>
          <PopoverDescription>Description text.</PopoverDescription>
        </PopoverHeader>
        <p>Popover body</p>
      </PopoverContent>
    </Popover>
  )
}

describe("Popover", () => {
  it("renders trigger without crashing", () => {
    render(<BasicPopover />)
    expect(
      screen.getByRole("button", { name: "Open Popover" })
    ).toBeInTheDocument()
  })

  it("content not visible initially", () => {
    render(<BasicPopover />)
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
  })

  it("shows content when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicPopover />)
    await user.click(screen.getByRole("button", { name: "Open Popover" }))
    expect(screen.getByText("Popover body")).toBeInTheDocument()
  })

  it("shows title when open", async () => {
    const { user } = renderWithUser(<BasicPopover />)
    await user.click(screen.getByRole("button", { name: "Open Popover" }))
    expect(screen.getByText("Title")).toBeInTheDocument()
  })

  it("shows description when open", async () => {
    const { user } = renderWithUser(<BasicPopover />)
    await user.click(screen.getByRole("button", { name: "Open Popover" }))
    expect(screen.getByText("Description text.")).toBeInTheDocument()
  })

  it("closes when Escape is pressed", async () => {
    const { user } = renderWithUser(<BasicPopover />)
    await user.click(screen.getByRole("button", { name: "Open Popover" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
  })

  it("PopoverContent has data-slot", async () => {
    const { user } = renderWithUser(<BasicPopover />)
    await user.click(screen.getByRole("button", { name: "Open Popover" }))
    expect(
      document.querySelector('[data-slot="popover-content"]')
    ).toBeInTheDocument()
  })

  it("PopoverAnchor renders without crashing", () => {
    render(
      <Popover>
        <PopoverAnchor>
          <span>Anchor</span>
        </PopoverAnchor>
      </Popover>
    )
    expect(screen.getByText("Anchor")).toBeInTheDocument()
  })
})
