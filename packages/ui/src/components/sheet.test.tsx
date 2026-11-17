import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./sheet"

function BasicSheet({
  side = "right" as const,
  showCloseButton = true,
}: {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button>Open Sheet</button>
      </SheetTrigger>
      <SheetContent side={side} showCloseButton={showCloseButton}>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Sheet description.</SheetDescription>
        </SheetHeader>
        <p>Sheet body</p>
        <SheetFooter>
          <SheetClose asChild>
            <button>Close Sheet</button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

describe("Sheet", () => {
  it("renders trigger without crashing", () => {
    render(<BasicSheet />)
    expect(
      screen.getByRole("button", { name: "Open Sheet" })
    ).toBeInTheDocument()
  })

  it("content is not visible initially", () => {
    render(<BasicSheet />)
    expect(screen.queryByText("Sheet body")).not.toBeInTheDocument()
  })

  it("opens when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicSheet />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(screen.getByText("Sheet body")).toBeInTheDocument()
  })

  it("shows title and description when open", async () => {
    const { user } = renderWithUser(<BasicSheet />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(screen.getByText("Sheet Title")).toBeInTheDocument()
    expect(screen.getByText("Sheet description.")).toBeInTheDocument()
  })

  it("closes when Close Sheet is clicked", async () => {
    const { user } = renderWithUser(<BasicSheet />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    await user.click(screen.getByRole("button", { name: "Close Sheet" }))
    expect(screen.queryByText("Sheet body")).not.toBeInTheDocument()
  })

  it("shows built-in close button when showCloseButton=true", async () => {
    const { user } = renderWithUser(<BasicSheet showCloseButton />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("hides built-in close button when showCloseButton=false", async () => {
    const { user } = renderWithUser(<BasicSheet showCloseButton={false} />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(
      screen.queryByRole("button", { name: "Close" })
    ).not.toBeInTheDocument()
  })

  it("closes with Escape key", async () => {
    const { user } = renderWithUser(<BasicSheet />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByText("Sheet body")).not.toBeInTheDocument()
  })

  it("sets data-side on content", async () => {
    const { user } = renderWithUser(<BasicSheet side="left" />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(
      document.querySelector('[data-slot="sheet-content"]')
    ).toHaveAttribute("data-side", "left")
  })

  it("renders from right side by default", async () => {
    const { user } = renderWithUser(<BasicSheet />)
    await user.click(screen.getByRole("button", { name: "Open Sheet" }))
    expect(
      document.querySelector('[data-slot="sheet-content"]')
    ).toHaveAttribute("data-side", "right")
  })
})
