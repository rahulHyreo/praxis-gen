import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./dialog"

function BasicDialog({
  showCloseButton = true,
}: {
  showCloseButton?: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button>Open</button>
      </DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description text.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button>Cancel</button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  it("renders trigger without crashing", () => {
    render(<BasicDialog />)
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument()
  })

  it("dialog content is not visible initially", () => {
    render(<BasicDialog />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens dialog when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("shows title when open", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByText("Dialog Title")).toBeInTheDocument()
  })

  it("shows description when open", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByText("Dialog description text.")).toBeInTheDocument()
  })

  it("closes when Cancel is clicked", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders close button when showCloseButton=true", async () => {
    const { user } = renderWithUser(<BasicDialog showCloseButton />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("does not render close button when showCloseButton=false", async () => {
    const { user } = renderWithUser(<BasicDialog showCloseButton={false} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(
      screen.queryByRole("button", { name: "Close" })
    ).not.toBeInTheDocument()
  })

  it("closes via the close button", async () => {
    const { user } = renderWithUser(<BasicDialog showCloseButton />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes when Escape key is pressed", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("dialog has correct ARIA role", async () => {
    const { user } = renderWithUser(<BasicDialog />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("DialogHeader renders", () => {
    render(<DialogHeader>Header content</DialogHeader>)
    expect(
      document.querySelector('[data-slot="dialog-header"]')
    ).toBeInTheDocument()
  })

  it("DialogFooter renders", () => {
    render(<DialogFooter>Footer content</DialogFooter>)
    expect(
      document.querySelector('[data-slot="dialog-footer"]')
    ).toBeInTheDocument()
  })

  it("DialogFooter with showCloseButton renders Close button", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle className="sr-only">Actions</DialogTitle>
          <DialogFooter showCloseButton>Actions</DialogFooter>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })
  /**
   * A wider dialog must pass its width with the `sm:` prefix.
   *
   * DialogContent's own base classes end in `sm:max-w-md`. tailwind-merge only
   * replaces a utility when the modifier matches too, so an unprefixed
   * `max-w-5xl` leaves `sm:max-w-md` in place — and because the media-query
   * rule is emitted later in the stylesheet, the dialog silently stays 448px
   * wide at every width above the breakpoint. Several dialogs shipped that way
   * before this was understood.
   */
  it("keeps an unprefixed width alongside the default, which is the trap", () => {
    render(
      <Dialog open>
        <DialogContent className="max-w-5xl">
          <DialogTitle className="sr-only">Wide</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    const el = document.querySelector('[data-slot="dialog-content"]')!
    expect(el.className).toContain("max-w-5xl")
    // The default survives and outranks it at >= 640px.
    expect(el.className).toContain("sm:max-w-md")
  })

  it("drops the default when the width is sm-prefixed", () => {
    render(
      <Dialog open>
        <DialogContent className="sm:max-w-5xl">
          <DialogTitle className="sr-only">Wide</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    const el = document.querySelector('[data-slot="dialog-content"]')!
    expect(el.className).toContain("sm:max-w-5xl")
    expect(el.className).not.toContain("sm:max-w-md")
  })
})
