import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

function BasicTabs() {
  return (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("renders without crashing", () => {
    render(<BasicTabs />)
    expect(screen.getByRole("tablist")).toBeInTheDocument()
  })

  it("has data-slot on root", () => {
    const { container } = render(<BasicTabs />)
    expect(container.querySelector('[data-slot="tabs"]')).toBeInTheDocument()
  })

  it("renders all tab triggers", () => {
    render(<BasicTabs />)
    expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Tab 2" })).toBeInTheDocument()
  })

  it("shows the default tab content", () => {
    render(<BasicTabs />)
    expect(screen.getByText("Content 1")).toBeInTheDocument()
  })

  it("switches content when a different tab is clicked", async () => {
    const { user } = renderWithUser(<BasicTabs />)
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))
    expect(screen.getByText("Content 2")).toBeInTheDocument()
  })

  it("marks the active tab with aria-selected=true", async () => {
    const { user } = renderWithUser(<BasicTabs />)
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))
    expect(screen.getByRole("tab", { name: "Tab 2" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveAttribute(
      "aria-selected",
      "false"
    )
  })

  it("is keyboard navigable with arrow keys", async () => {
    const { user } = renderWithUser(<BasicTabs />)
    screen.getByRole("tab", { name: "Tab 1" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Tab 2" })).toHaveFocus()
  })

  it("applies default variant to TabsList", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList variant="default">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(document.querySelector('[data-slot="tabs-list"]')).toHaveAttribute(
      "data-variant",
      "default"
    )
  })

  it("applies line variant to TabsList", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(document.querySelector('[data-slot="tabs-list"]')).toHaveAttribute(
      "data-variant",
      "line"
    )
  })

  it("disabled tab is not interactive", async () => {
    const { user } = renderWithUser(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" disabled>
            Tab 2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    await user.click(screen.getByRole("tab", { name: "Tab 2" }))
    // Tab 1 content remains visible because Tab 2 is disabled
    expect(screen.getByText("Content 1")).toBeInTheDocument()
  })
})
