import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "./badge"

describe("Badge", () => {
  it("renders without crashing", () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText("New")).toHaveAttribute("data-slot", "badge")
  })

  it("applies default variant", () => {
    render(<Badge variant="default">Default</Badge>)
    expect(screen.getByText("Default")).toHaveAttribute(
      "data-variant",
      "default"
    )
  })

  it("applies secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText("Secondary")).toHaveAttribute(
      "data-variant",
      "secondary"
    )
  })

  it("applies destructive variant", () => {
    render(<Badge variant="destructive">Danger</Badge>)
    expect(screen.getByText("Danger")).toHaveAttribute(
      "data-variant",
      "destructive"
    )
  })

  it("applies outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>)
    expect(screen.getByText("Outline")).toHaveAttribute(
      "data-variant",
      "outline"
    )
  })

  it("applies ghost variant", () => {
    render(<Badge variant="ghost">Ghost</Badge>)
    expect(screen.getByText("Ghost")).toHaveAttribute("data-variant", "ghost")
  })

  it("applies link variant", () => {
    render(<Badge variant="link">Link</Badge>)
    expect(screen.getByText("Link")).toHaveAttribute("data-variant", "link")
  })

  it("accepts extra className", () => {
    render(<Badge className="my-class">Styled</Badge>)
    expect(screen.getByText("Styled")).toHaveClass("my-class")
  })

  it("renders as child when asChild is true", () => {
    render(
      <Badge asChild>
        <a href="#">Badge link</a>
      </Badge>
    )
    expect(screen.getByRole("link", { name: "Badge link" })).toBeInTheDocument()
  })
})
