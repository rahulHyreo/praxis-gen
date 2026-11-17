import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card"

describe("Card", () => {
  it("renders without crashing", () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText("Card content")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Card>Card</Card>)
    expect(screen.getByText("Card")).toHaveAttribute("data-slot", "card")
  })

  it("applies default size", () => {
    render(<Card size="default">Card</Card>)
    expect(screen.getByText("Card")).toHaveAttribute("data-size", "default")
  })

  it("applies sm size", () => {
    render(<Card size="sm">Card sm</Card>)
    expect(screen.getByText("Card sm")).toHaveAttribute("data-size", "sm")
  })

  it("applies extra className", () => {
    render(<Card className="my-card">Card</Card>)
    expect(screen.getByText("Card")).toHaveClass("my-card")
  })
})

describe("CardHeader", () => {
  it("renders without crashing", () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText("Header")).toHaveAttribute(
      "data-slot",
      "card-header"
    )
  })
})

describe("CardTitle", () => {
  it("renders without crashing", () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "card-title")
  })
})

describe("CardDescription", () => {
  it("renders without crashing", () => {
    render(<CardDescription>Desc</CardDescription>)
    expect(screen.getByText("Desc")).toHaveAttribute(
      "data-slot",
      "card-description"
    )
  })
})

describe("CardAction", () => {
  it("renders without crashing", () => {
    render(<CardAction>Action</CardAction>)
    expect(screen.getByText("Action")).toHaveAttribute(
      "data-slot",
      "card-action"
    )
  })
})

describe("CardContent", () => {
  it("renders without crashing", () => {
    render(<CardContent>Content</CardContent>)
    expect(screen.getByText("Content")).toHaveAttribute(
      "data-slot",
      "card-content"
    )
  })
})

describe("CardFooter", () => {
  it("renders without crashing", () => {
    render(<CardFooter>Footer</CardFooter>)
    expect(screen.getByText("Footer")).toHaveAttribute(
      "data-slot",
      "card-footer"
    )
  })
})

describe("Card composition", () => {
  it("renders all sub-components together", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
          <CardDescription>A description</CardDescription>
        </CardHeader>
        <CardContent>Body text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>
    )
    expect(screen.getByText("My Card")).toBeInTheDocument()
    expect(screen.getByText("A description")).toBeInTheDocument()
    expect(screen.getByText("Body text")).toBeInTheDocument()
    expect(screen.getByText("Footer text")).toBeInTheDocument()
  })
})
