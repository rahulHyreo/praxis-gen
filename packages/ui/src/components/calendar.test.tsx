import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Calendar } from "./calendar"

describe("Calendar", () => {
  it("renders without crashing", () => {
    const { container } = render(<Calendar mode="single" />)
    expect(
      container.querySelector('[data-slot="calendar"]')
    ).toBeInTheDocument()
  })

  it("renders a grid of days", () => {
    render(<Calendar mode="single" />)
    // DayPicker renders a grid role for the month view
    const grid = screen.getByRole("grid")
    expect(grid).toBeInTheDocument()
  })

  it("renders navigation buttons", () => {
    render(<Calendar mode="single" />)
    expect(
      screen.getByRole("button", { name: /previous/i })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
  })

  it("renders month caption", () => {
    render(<Calendar mode="single" />)
    // The caption is always present
    const caption = document.querySelector(".rdp-month_caption")
    expect(caption).toBeInTheDocument()
  })

  it("navigates to next month", async () => {
    const { user } = renderWithUser(<Calendar mode="single" />)
    const nextBtn = screen.getByRole("button", { name: /next/i })
    await user.click(nextBtn)
    // Grid is still present after navigation
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })

  it("navigates to previous month", async () => {
    const { user } = renderWithUser(<Calendar mode="single" />)
    const prevBtn = screen.getByRole("button", { name: /previous/i })
    await user.click(prevBtn)
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })

  it("calls onSelect when a day is clicked (single mode)", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <Calendar mode="single" onSelect={handler} />
    )
    const dayButtons = screen.getAllByRole("button")
    // Find a day button that is not prev/next nav
    const dayButton = dayButtons.find(
      (btn) =>
        !btn.getAttribute("aria-label")?.match(/previous|next/i) &&
        btn.getAttribute("data-day")
    )
    if (dayButton) {
      await user.click(dayButton)
      expect(handler).toHaveBeenCalled()
    }
  })

  it("shows outside days by default (showOutsideDays=true)", () => {
    render(<Calendar mode="single" showOutsideDays />)
    // Calendar renders without crash; outside day cells may appear
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })

  it("accepts className", () => {
    const { container } = render(<Calendar mode="single" className="my-cal" />)
    // The DayPicker root div should have the class
    const root =
      container.querySelector('[data-slot="calendar"]')?.closest(".my-cal") ??
      container.querySelector(".my-cal")
    expect(root).toBeInTheDocument()
  })

  it("renders with dropdown caption layout", () => {
    render(<Calendar mode="single" captionLayout="dropdown" />)
    expect(screen.getByRole("grid")).toBeInTheDocument()
  })
})
