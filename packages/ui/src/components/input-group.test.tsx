import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group"

describe("InputGroup", () => {
  it("renders without crashing", () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>
    )
    expect(
      document.querySelector('[data-slot="input-group"]')
    ).toBeInTheDocument()
  })

  it("has role=group", () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>
    )
    expect(screen.getAllByRole("group")[0]).toBeInTheDocument()
  })

  it("applies extra className", () => {
    render(
      <InputGroup className="my-group">
        <InputGroupInput />
      </InputGroup>
    )
    expect(document.querySelector('[data-slot="input-group"]')).toHaveClass(
      "my-group"
    )
  })
})

describe("InputGroupAddon", () => {
  it("renders without crashing", () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    )
    expect(
      document.querySelector('[data-slot="input-group-addon"]')
    ).toBeInTheDocument()
  })

  it("applies inline-start align by default", () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    )
    expect(
      document.querySelector('[data-slot="input-group-addon"]')
    ).toHaveAttribute("data-align", "inline-start")
  })

  it("applies inline-end align", () => {
    render(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">%</InputGroupAddon>
      </InputGroup>
    )
    expect(
      document.querySelector('[data-slot="input-group-addon"]')
    ).toHaveAttribute("data-align", "inline-end")
  })

  it("focuses input when addon is clicked", async () => {
    const { user } = renderWithUser(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput aria-label="Amount" />
      </InputGroup>
    )
    await user.click(document.querySelector('[data-slot="input-group-addon"]')!)
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus()
  })
})

describe("InputGroupButton", () => {
  it("renders without crashing", () => {
    render(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Send</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument()
  })

  it("fires onClick", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={handler}>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
    await user.click(screen.getByRole("button", { name: "Go" }))
    expect(handler).toHaveBeenCalled()
  })
})

describe("InputGroupText", () => {
  it("renders without crashing", () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>@</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    )
    expect(screen.getByText("@")).toBeInTheDocument()
  })
})

describe("InputGroupInput", () => {
  it("renders a text input", () => {
    render(
      <InputGroup>
        <InputGroupInput aria-label="Search" />
      </InputGroup>
    )
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument()
  })

  it("has data-slot=input-group-control", () => {
    render(
      <InputGroup>
        <InputGroupInput />
      </InputGroup>
    )
    const input = document.querySelector('[data-slot="input-group-control"]')
    expect(input).toBeInTheDocument()
  })

  it("accepts typed input", async () => {
    const { user } = renderWithUser(
      <InputGroup>
        <InputGroupInput aria-label="Query" />
      </InputGroup>
    )
    await user.type(screen.getByRole("textbox", { name: "Query" }), "hello")
    expect(screen.getByRole("textbox", { name: "Query" })).toHaveValue("hello")
  })
})

describe("InputGroupTextarea", () => {
  it("renders a textarea", () => {
    render(
      <InputGroup>
        <InputGroupTextarea aria-label="Message" />
      </InputGroup>
    )
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument()
  })

  it("has data-slot=input-group-control", () => {
    render(
      <InputGroup>
        <InputGroupTextarea />
      </InputGroup>
    )
    const ta = document.querySelector('[data-slot="input-group-control"]')
    expect(ta?.tagName).toBe("TEXTAREA")
  })
})
