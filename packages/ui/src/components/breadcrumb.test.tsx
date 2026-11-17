import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./breadcrumb"

describe("Breadcrumb", () => {
  it("renders without crashing", () => {
    render(<Breadcrumb />)
    expect(screen.getByRole("navigation")).toBeInTheDocument()
  })

  it("has aria-label=breadcrumb", () => {
    render(<Breadcrumb />)
    expect(
      screen.getByRole("navigation", { name: "breadcrumb" })
    ).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Breadcrumb />)
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "data-slot",
      "breadcrumb"
    )
  })
})

describe("BreadcrumbList", () => {
  it("renders as ol", () => {
    render(<BreadcrumbList />)
    const el = document.querySelector('[data-slot="breadcrumb-list"]')
    expect(el?.tagName).toBe("OL")
  })
})

describe("BreadcrumbItem", () => {
  it("renders as li", () => {
    render(<BreadcrumbItem>Home</BreadcrumbItem>)
    expect(screen.getByText("Home").tagName).toBe("LI")
  })
})

describe("BreadcrumbLink", () => {
  it("renders as anchor", () => {
    render(<BreadcrumbLink href="/">Home</BreadcrumbLink>)
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    )
  })

  it("renders as child when asChild", () => {
    render(
      <BreadcrumbLink asChild>
        <button type="button">Home</button>
      </BreadcrumbLink>
    )
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument()
  })
})

describe("BreadcrumbPage", () => {
  it("renders with aria-current=page", () => {
    render(<BreadcrumbPage>Current</BreadcrumbPage>)
    expect(screen.getByText("Current")).toHaveAttribute("aria-current", "page")
  })

  it("is aria-disabled", () => {
    render(<BreadcrumbPage>Current</BreadcrumbPage>)
    expect(screen.getByText("Current")).toHaveAttribute("aria-disabled", "true")
  })
})

describe("BreadcrumbSeparator", () => {
  it("renders without crashing", () => {
    render(<BreadcrumbSeparator />)
    const el = document.querySelector('[data-slot="breadcrumb-separator"]')
    expect(el).toBeInTheDocument()
  })

  it("is aria-hidden", () => {
    render(<BreadcrumbSeparator />)
    const el = document.querySelector('[data-slot="breadcrumb-separator"]')
    expect(el).toHaveAttribute("aria-hidden", "true")
  })

  it("renders custom children", () => {
    render(<BreadcrumbSeparator>/</BreadcrumbSeparator>)
    expect(screen.getByText("/")).toBeInTheDocument()
  })
})

describe("BreadcrumbEllipsis", () => {
  it("renders without crashing", () => {
    render(<BreadcrumbEllipsis />)
    const el = document.querySelector('[data-slot="breadcrumb-ellipsis"]')
    expect(el).toBeInTheDocument()
  })

  it("has sr-only text 'More'", () => {
    render(<BreadcrumbEllipsis />)
    expect(screen.getByText("More")).toHaveClass("sr-only")
  })
})

describe("Breadcrumb composition", () => {
  it("renders a full breadcrumb trail", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
    expect(
      screen.getByRole("navigation", { name: "breadcrumb" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByText("Current")).toBeInTheDocument()
  })
})
