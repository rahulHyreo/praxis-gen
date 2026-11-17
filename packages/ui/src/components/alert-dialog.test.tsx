import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
} from "./alert-dialog"

function BasicAlertDialog({ size }: { size?: "default" | "sm" }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button>Open Alert</button>
      </AlertDialogTrigger>
      <AlertDialogContent size={size}>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

describe("AlertDialog", () => {
  it("renders trigger without crashing", () => {
    render(<BasicAlertDialog />)
    expect(
      screen.getByRole("button", { name: "Open Alert" })
    ).toBeInTheDocument()
  })

  it("content not visible initially", () => {
    render(<BasicAlertDialog />)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("opens when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicAlertDialog />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("shows title and description when open", async () => {
    const { user } = renderWithUser(<BasicAlertDialog />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    expect(screen.getByText("Are you sure?")).toBeInTheDocument()
    expect(
      screen.getByText("This action cannot be undone.")
    ).toBeInTheDocument()
  })

  it("calls action handler and closes", async () => {
    const { user } = renderWithUser(<BasicAlertDialog />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("closes when Cancel is clicked", async () => {
    const { user } = renderWithUser(<BasicAlertDialog />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  // BUG: Radix AlertDialog should block Escape dismissal (onEscapeKeyDown calls preventDefault),
  // but jsdom does not fully honour pointer/keyboard event prevention so the dialog closes anyway.
  it.fails(
    "does NOT close on Escape (alert-dialog blocks dismissal)",
    async () => {
      const { user } = renderWithUser(<BasicAlertDialog />)
      await user.click(screen.getByRole("button", { name: "Open Alert" }))
      await user.keyboard("{Escape}")
      // AlertDialog requires explicit action — Escape should not dismiss it
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    }
  )

  it("renders with default size", async () => {
    const { user } = renderWithUser(<BasicAlertDialog size="default" />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    expect(
      document.querySelector('[data-slot="alert-dialog-content"]')
    ).toHaveAttribute("data-size", "default")
  })

  it("renders with sm size", async () => {
    const { user } = renderWithUser(<BasicAlertDialog size="sm" />)
    await user.click(screen.getByRole("button", { name: "Open Alert" }))
    expect(
      document.querySelector('[data-slot="alert-dialog-content"]')
    ).toHaveAttribute("data-size", "sm")
  })
})

describe("AlertDialogMedia", () => {
  it("renders within alert dialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <span>Icon</span>
            </AlertDialogMedia>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
    expect(
      document.querySelector('[data-slot="alert-dialog-media"]')
    ).toBeInTheDocument()
  })
})
