import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "./avatar"

describe("Avatar", () => {
  it("renders without crashing", () => {
    const { container } = render(<Avatar />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    const { container } = render(<Avatar />)
    expect(container.firstChild).toHaveAttribute("data-slot", "avatar")
  })

  it("applies default size", () => {
    const { container } = render(<Avatar size="default" />)
    expect(container.firstChild).toHaveAttribute("data-size", "default")
  })

  it("applies sm size", () => {
    const { container } = render(<Avatar size="sm" />)
    expect(container.firstChild).toHaveAttribute("data-size", "sm")
  })

  it("applies lg size", () => {
    const { container } = render(<Avatar size="lg" />)
    expect(container.firstChild).toHaveAttribute("data-size", "lg")
  })

  it("renders fallback when no image source", () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText("AB")).toBeInTheDocument()
  })

  it("renders with image and fallback", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )
    // Fallback is shown when image fails to load in jsdom
    expect(screen.getByText("JD")).toBeInTheDocument()
  })
})

describe("AvatarFallback", () => {
  it("has data-slot attribute", () => {
    render(
      <Avatar>
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText("FB")).toHaveAttribute(
      "data-slot",
      "avatar-fallback"
    )
  })
})

describe("AvatarBadge", () => {
  it("renders without crashing", () => {
    render(
      <Avatar>
        <AvatarBadge />
      </Avatar>
    )
    const badge = document.querySelector('[data-slot="avatar-badge"]')
    expect(badge).toBeInTheDocument()
  })
})

describe("AvatarGroup", () => {
  it("renders without crashing", () => {
    render(
      <AvatarGroup>
        <Avatar />
      </AvatarGroup>
    )
    const group = document.querySelector('[data-slot="avatar-group"]')
    expect(group).toBeInTheDocument()
  })
})

describe("AvatarGroupCount", () => {
  it("renders without crashing", () => {
    render(<AvatarGroupCount>+3</AvatarGroupCount>)
    expect(screen.getByText("+3")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<AvatarGroupCount>+3</AvatarGroupCount>)
    expect(screen.getByText("+3")).toHaveAttribute(
      "data-slot",
      "avatar-group-count"
    )
  })
})
