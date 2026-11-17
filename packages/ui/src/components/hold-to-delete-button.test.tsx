import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { HoldToDeleteButton } from "./hold-to-delete-button"

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe("HoldToDeleteButton", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders children and data-slot", () => {
    render(<HoldToDeleteButton onDelete={vi.fn()}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveTextContent("✕")
    expect(btn).toHaveAttribute("data-slot", "hold-to-delete-button")
    expect(btn).toHaveAttribute("data-holding", "false")
  })

  it("fires onDelete once after the full hold duration", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    expect(btn).toHaveAttribute("data-holding", "true")
    expect(onDelete).not.toHaveBeenCalled()

    advance(1500)
    expect(onDelete).toHaveBeenCalledOnce()
    expect(btn).toHaveAttribute("data-holding", "false")

    // Releasing after the delete already fired must not surface the hint.
    fireEvent.pointerUp(btn)
    expect(screen.queryByText("Hold to delete")).not.toBeInTheDocument()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("respects a custom holdMs", () => {
    const onDelete = vi.fn()
    render(
      <HoldToDeleteButton onDelete={onDelete} holdMs={600}>
        ✕
      </HoldToDeleteButton>
    )
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    advance(599)
    expect(onDelete).not.toHaveBeenCalled()
    advance(1)
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("does not fire and shows the hint when released early", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    advance(500)
    fireEvent.pointerUp(btn)

    expect(onDelete).not.toHaveBeenCalled()
    expect(btn).toHaveAttribute("data-holding", "false")
    expect(screen.getByText("Hold to delete")).toBeInTheDocument()

    // hint auto-dismisses
    advance(1400)
    expect(screen.queryByText("Hold to delete")).not.toBeInTheDocument()
  })

  // The record tables clip their card (`overflow-hidden`) and stick their
  // header at z-10, so an in-flow bubble is cut off or painted over for the
  // first row — the one row whose bubble reaches into the header band. The
  // bubble therefore lives in a portal on document.body, outside the button.
  it("renders the hint in a portal on document.body, not inside the button", () => {
    const { container } = render(
      <HoldToDeleteButton onDelete={vi.fn()}>✕</HoldToDeleteButton>
    )
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("data-hint", "false")

    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)

    const bubble = screen.getByText("Hold to delete")
    expect(btn).toHaveAttribute("data-hint", "true")
    expect(btn).not.toContainElement(bubble)
    expect(container).not.toContainElement(bubble)
    expect(bubble.parentElement).toBe(document.body)
    expect(bubble.className).toContain("fixed")

    advance(1400)
    expect(btn).toHaveAttribute("data-hint", "false")
    expect(screen.queryByText("Hold to delete")).not.toBeInTheDocument()
  })

  it("uses a custom hint label", () => {
    render(
      <HoldToDeleteButton onDelete={vi.fn()} hint="Hold to remove">
        ✕
      </HoldToDeleteButton>
    )
    const btn = screen.getByRole("button")
    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
    expect(screen.getByText("Hold to remove")).toBeInTheDocument()
  })

  it("cancels the hold when the pointer leaves", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    advance(500)
    fireEvent.pointerLeave(btn)
    advance(2000)

    expect(onDelete).not.toHaveBeenCalled()
    expect(btn).toHaveAttribute("data-holding", "false")
  })

  it("cancels the hold on pointer cancel", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    fireEvent.pointerCancel(btn)
    advance(2000)

    expect(onDelete).not.toHaveBeenCalled()
  })

  it("ignores a second pointerDown while already holding", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    advance(1000)
    fireEvent.pointerDown(btn) // should not restart the timer
    advance(500)

    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("does not fire when disabled", () => {
    const onDelete = vi.fn()
    render(
      <HoldToDeleteButton onDelete={onDelete} disabled>
        ✕
      </HoldToDeleteButton>
    )
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()

    fireEvent.pointerDown(btn)
    advance(2000)
    expect(onDelete).not.toHaveBeenCalled()
    expect(btn).toHaveAttribute("data-holding", "false")
  })

  it("supports keyboard hold via Enter", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.keyDown(btn, { key: "Enter" })
    expect(btn).toHaveAttribute("data-holding", "true")
    advance(1500)
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("supports keyboard hold via Space and shows hint on early keyup", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.keyDown(btn, { key: " " })
    advance(300)
    fireEvent.keyUp(btn, { key: " " })
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText("Hold to delete")).toBeInTheDocument()
  })

  it("ignores auto-repeat keydown", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.keyDown(btn, { key: "Enter", repeat: true })
    expect(btn).toHaveAttribute("data-holding", "false")
    advance(2000)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it("ignores unrelated keys", () => {
    const onDelete = vi.fn()
    render(<HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>)
    const btn = screen.getByRole("button")

    fireEvent.keyDown(btn, { key: "a" })
    fireEvent.keyUp(btn, { key: "a" })
    advance(2000)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it("forwards consumer event handlers, className and aria-label", () => {
    const onPointerDown = vi.fn()
    const onPointerUp = vi.fn()
    render(
      <HoldToDeleteButton
        onDelete={vi.fn()}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="extra-class"
        aria-label="Delete thing"
      >
        ✕
      </HoldToDeleteButton>
    )
    const btn = screen.getByRole("button", { name: "Delete thing" })
    expect(btn).toHaveClass("extra-class")

    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
    expect(onPointerDown).toHaveBeenCalledOnce()
    expect(onPointerUp).toHaveBeenCalledOnce()
  })

  it("forwards pointer-leave, pointer-cancel and key handlers to the consumer", () => {
    const onPointerLeave = vi.fn()
    const onPointerCancel = vi.fn()
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    render(
      <HoldToDeleteButton
        onDelete={vi.fn()}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        ✕
      </HoldToDeleteButton>
    )
    const btn = screen.getByRole("button")

    fireEvent.pointerDown(btn)
    fireEvent.pointerLeave(btn)
    fireEvent.pointerDown(btn)
    fireEvent.pointerCancel(btn)
    fireEvent.keyDown(btn, { key: "Enter" })
    fireEvent.keyUp(btn, { key: "Enter" })

    expect(onPointerLeave).toHaveBeenCalledOnce()
    expect(onPointerCancel).toHaveBeenCalledOnce()
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(onKeyUp).toHaveBeenCalledOnce()
  })

  it("applies the requested button variant/size", () => {
    render(
      <HoldToDeleteButton onDelete={vi.fn()} variant="destructive" size="sm">
        ✕
      </HoldToDeleteButton>
    )
    // buttonVariants("destructive") contributes the destructive background token
    expect(screen.getByRole("button").className).toContain("bg-destructive/10")
  })

  it("clears timers on unmount without firing", () => {
    const onDelete = vi.fn()
    const { unmount } = render(
      <HoldToDeleteButton onDelete={onDelete}>✕</HoldToDeleteButton>
    )
    fireEvent.pointerDown(screen.getByRole("button"))
    unmount()
    advance(2000)
    expect(onDelete).not.toHaveBeenCalled()
  })
})
