import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "./empty"

describe("Empty", () => {
  it("renders without crashing", () => {
    render(<Empty>No results</Empty>)
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Empty>No results</Empty>)
    expect(screen.getByText("No results")).toHaveAttribute("data-slot", "empty")
  })

  it("applies extra className", () => {
    render(<Empty className="custom">Empty</Empty>)
    expect(screen.getByText("Empty")).toHaveClass("custom")
  })
})

describe("EmptyHeader", () => {
  it("renders without crashing", () => {
    render(<EmptyHeader>Header</EmptyHeader>)
    expect(screen.getByText("Header")).toHaveAttribute(
      "data-slot",
      "empty-header"
    )
  })
})

describe("EmptyTitle", () => {
  it("renders without crashing", () => {
    render(<EmptyTitle>No Data Found</EmptyTitle>)
    expect(screen.getByText("No Data Found")).toHaveAttribute(
      "data-slot",
      "empty-title"
    )
  })
})

describe("EmptyDescription", () => {
  it("renders without crashing", () => {
    render(<EmptyDescription>Try adding some items.</EmptyDescription>)
    expect(screen.getByText("Try adding some items.")).toHaveAttribute(
      "data-slot",
      "empty-description"
    )
  })
})

describe("EmptyContent", () => {
  it("renders without crashing", () => {
    render(<EmptyContent>Action area</EmptyContent>)
    expect(screen.getByText("Action area")).toHaveAttribute(
      "data-slot",
      "empty-content"
    )
  })
})

describe("EmptyMedia", () => {
  it("renders without crashing with default variant", () => {
    render(<EmptyMedia />)
    const el = document.querySelector('[data-slot="empty-icon"]')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute("data-variant", "default")
  })

  it("renders icon variant", () => {
    render(<EmptyMedia variant="icon" />)
    const el = document.querySelector('[data-slot="empty-icon"]')
    expect(el).toHaveAttribute("data-variant", "icon")
  })
})

describe("Empty composition", () => {
  it("renders all sub-components", () => {
    render(
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing here</EmptyTitle>
          <EmptyDescription>Add items to get started.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <button>Add item</button>
        </EmptyContent>
      </Empty>
    )
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByText("Add items to get started.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument()
  })
})
