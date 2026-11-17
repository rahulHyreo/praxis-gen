import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Skeleton } from "./skeleton"

describe("Skeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveAttribute("data-slot", "skeleton")
  })

  it("applies animate-pulse class", () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass("animate-pulse")
  })

  it("accepts extra className", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    expect(container.firstChild).toHaveClass("h-4", "w-32")
  })

  it("renders children when provided", () => {
    render(<Skeleton>Loading...</Skeleton>)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })
})
