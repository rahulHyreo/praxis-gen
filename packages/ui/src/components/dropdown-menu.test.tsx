import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu"

function BasicDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button>Open Menu</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Label</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Shortcut item
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe("DropdownMenu", () => {
  it("renders trigger without crashing", () => {
    render(<BasicDropdown />)
    expect(
      screen.getByRole("button", { name: "Open Menu" })
    ).toBeInTheDocument()
  })

  it("content is not visible initially", () => {
    render(<BasicDropdown />)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("opens when trigger is clicked", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("shows menu items when open", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(
      screen.getByRole("menuitem", { name: "Profile" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Settings" })
    ).toBeInTheDocument()
  })

  it("shows label when open", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(screen.getByText("Label")).toBeInTheDocument()
  })

  it("calls onClick on menu item", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={handler}>Click me</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("menuitem", { name: "Click me" }))
    expect(handler).toHaveBeenCalled()
  })

  it("closes after selecting an item", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Profile" }))
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("closes with Escape key", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("renders shortcut text", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    expect(screen.getByText("⌘K")).toBeInTheDocument()
  })

  it("renders destructive variant item", async () => {
    const { user } = renderWithUser(<BasicDropdown />)
    await user.click(screen.getByRole("button", { name: "Open Menu" }))
    const deleteItem = screen.getByRole("menuitem", { name: "Delete" })
    expect(deleteItem).toHaveAttribute("data-variant", "destructive")
  })
})

describe("DropdownMenuCheckboxItem", () => {
  it("renders without crashing", async () => {
    const { user } = renderWithUser(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false}>
            Checkbox Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Checkbox Item" })
    ).toBeInTheDocument()
  })

  it("shows checked state", async () => {
    const { user } = renderWithUser(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={true}>
            Checked
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Checked" })
    ).toHaveAttribute("aria-checked", "true")
  })
})

describe("DropdownMenuRadioGroup", () => {
  it("renders radio items without crashing", async () => {
    const { user } = renderWithUser(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(
      screen.getByRole("menuitemradio", { name: "Option A" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitemradio", { name: "Option A" })
    ).toHaveAttribute("aria-checked", "true")
  })
})

describe("DropdownMenuSub", () => {
  it("renders sub-trigger without crashing", async () => {
    const { user } = renderWithUser(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByText("More options")).toBeInTheDocument()
  })
})
