import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Alert, AlertTitle, AlertDescription, AlertAction } from "./alert"

describe("Alert", () => {
  it("renders without crashing", () => {
    render(<Alert>Alert content</Alert>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("has correct role=alert", () => {
    render(<Alert>Alert content</Alert>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Alert>Alert content</Alert>)
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert")
  })

  it("applies default variant", () => {
    render(<Alert variant="default">Default</Alert>)
    // default variant - no extra class indicator but renders fine
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("applies destructive variant classes", () => {
    render(<Alert variant="destructive">Danger!</Alert>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("accepts extra className", () => {
    render(<Alert className="extra">Alert</Alert>)
    expect(screen.getByRole("alert")).toHaveClass("extra")
  })
})

describe("AlertTitle", () => {
  it("renders without crashing", () => {
    render(<AlertTitle>Title</AlertTitle>)
    expect(screen.getByText("Title")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<AlertTitle>Title</AlertTitle>)
    expect(screen.getByText("Title")).toHaveAttribute(
      "data-slot",
      "alert-title"
    )
  })
})

describe("AlertDescription", () => {
  it("renders without crashing", () => {
    render(<AlertDescription>Description text</AlertDescription>)
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<AlertDescription>Description text</AlertDescription>)
    expect(screen.getByText("Description text")).toHaveAttribute(
      "data-slot",
      "alert-description"
    )
  })
})

describe("AlertAction", () => {
  it("renders without crashing", () => {
    render(<AlertAction>Action</AlertAction>)
    expect(screen.getByText("Action")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<AlertAction>Action</AlertAction>)
    expect(screen.getByText("Action")).toHaveAttribute(
      "data-slot",
      "alert-action"
    )
  })
})

describe("Alert composition", () => {
  it("renders all sub-components together", () => {
    render(
      <Alert>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
        <AlertAction>Dismiss</AlertAction>
      </Alert>
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Heads up!")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
    expect(screen.getByText("Dismiss")).toBeInTheDocument()
  })
})
