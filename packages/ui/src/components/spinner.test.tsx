import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Spinner } from "./spinner"

describe("Spinner", () => {
  it("renders without crashing", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("has accessible label", () => {
    render(<Spinner />)
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  it("has role=status for accessibility", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("applies animate-spin class", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toHaveClass("animate-spin")
  })

  it("accepts extra className", () => {
    render(<Spinner className="size-8" />)
    expect(screen.getByRole("status")).toHaveClass("size-8")
  })
})
