import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select"

function BasicSelect({
  onValueChange,
  defaultValue,
}: {
  onValueChange?: (v: string) => void
  defaultValue?: string
}) {
  return (
    <Select onValueChange={onValueChange} defaultValue={defaultValue}>
      <SelectTrigger aria-label="Fruit">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
        </SelectGroup>
        <SelectSeparator />
      </SelectContent>
    </Select>
  )
}

describe("Select", () => {
  it("renders trigger without crashing", () => {
    render(<BasicSelect />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows placeholder when no value selected", () => {
    render(<BasicSelect />)
    expect(screen.getByText("Pick a fruit")).toBeInTheDocument()
  })

  it("opens listbox when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  it("shows options when open", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Orange" })).toBeInTheDocument()
  })

  it("shows group label when open", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    await user.click(screen.getByRole("combobox"))
    expect(screen.getByText("Fruits")).toBeInTheDocument()
  })

  it("selects an item when clicked", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(<BasicSelect onValueChange={handler} />)
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "Apple" }))
    expect(handler).toHaveBeenCalledWith("apple")
  })

  it("closes after selecting an item", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "Apple" }))
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("displays selected value in trigger", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "Banana" }))
    expect(screen.getByText("Banana")).toBeInTheDocument()
  })

  it("shows default value when provided", () => {
    render(<BasicSelect defaultValue="orange" />)
    expect(screen.getByText("Orange")).toBeInTheDocument()
  })

  it("trigger has data-slot", () => {
    render(<BasicSelect />)
    expect(
      document.querySelector('[data-slot="select-trigger"]')
    ).toBeInTheDocument()
  })

  it("applies sm size to trigger", () => {
    render(
      <Select>
        <SelectTrigger size="sm" aria-label="Size sm">
          <SelectValue placeholder="Small" />
        </SelectTrigger>
      </Select>
    )
    expect(
      document.querySelector('[data-slot="select-trigger"]')
    ).toHaveAttribute("data-size", "sm")
  })

  it("is keyboard accessible — opens with Space", async () => {
    const { user } = renderWithUser(<BasicSelect />)
    screen.getByRole("combobox").focus()
    await user.keyboard(" ")
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })
})
