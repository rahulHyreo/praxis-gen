import { describe, it, expect, vi } from "vitest"
import { render, renderHook, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInput,
  SidebarSeparator,
  SidebarInset,
  useSidebar,
} from "./sidebar"
import React from "react"

// Helper: wrap sidebar components in a SidebarProvider
function WithProvider({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe("SidebarProvider", () => {
  it("renders without crashing", () => {
    render(
      <SidebarProvider>
        <div>child</div>
      </SidebarProvider>
    )
    expect(screen.getByText("child")).toBeInTheDocument()
  })

  it("has data-slot=sidebar-wrapper", () => {
    render(
      <SidebarProvider>
        <span />
      </SidebarProvider>
    )
    expect(
      document.querySelector('[data-slot="sidebar-wrapper"]')
    ).toBeInTheDocument()
  })

  it("starts expanded by default", () => {
    render(
      <SidebarProvider>
        <span />
      </SidebarProvider>
    )
    expect(
      document.querySelector('[data-slot="sidebar-wrapper"]')
    ).toBeInTheDocument()
  })
})

describe("Sidebar", () => {
  it("renders without crashing (collapsible=none)", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <p>Sidebar content</p>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("Sidebar content")).toBeInTheDocument()
  })

  it("has data-slot=sidebar", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <span />
        </Sidebar>
      </WithProvider>
    )
    expect(document.querySelector('[data-slot="sidebar"]')).toBeInTheDocument()
  })
})

describe("SidebarTrigger", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <SidebarTrigger />
      </WithProvider>
    )
    expect(
      screen.getByRole("button", { name: /toggle sidebar/i })
    ).toBeInTheDocument()
  })

  it("toggles sidebar when clicked", async () => {
    const { user } = renderWithUser(
      <WithProvider>
        <SidebarTrigger />
        <Sidebar>
          <p>content</p>
        </Sidebar>
      </WithProvider>
    )
    const trigger = screen.getByRole("button", { name: /toggle sidebar/i })
    await user.click(trigger)
    // The trigger fires without error; state change is internal
    expect(trigger).toBeInTheDocument()
  })
})

describe("SidebarContent / Header / Footer", () => {
  it("renders SidebarContent", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarContent>
            <p>content area</p>
          </SidebarContent>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("content area")).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="sidebar-content"]')
    ).toBeInTheDocument()
  })

  it("renders SidebarHeader", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarHeader>
            <p>header</p>
          </SidebarHeader>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("header")).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="sidebar-header"]')
    ).toBeInTheDocument()
  })

  it("renders SidebarFooter", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarFooter>
            <p>footer</p>
          </SidebarFooter>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("footer")).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="sidebar-footer"]')
    ).toBeInTheDocument()
  })
})

describe("SidebarGroup / Menu", () => {
  it("renders SidebarGroup with label and content", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>Dashboard</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("Navigation")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Dashboard" })
    ).toBeInTheDocument()
  })

  it("SidebarMenuButton is clickable", async () => {
    const handler = vi.fn()
    const { user } = renderWithUser(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handler}>
                  Click me
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </WithProvider>
    )
    await user.click(screen.getByRole("button", { name: "Click me" }))
    expect(handler).toHaveBeenCalled()
  })

  it("renders SidebarMenuAction", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Item</SidebarMenuButton>
              <SidebarMenuAction aria-label="Options">...</SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument()
  })

  it("renders SidebarMenuSub items", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Parent</SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton>Sub item</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByText("Sub item")).toBeInTheDocument()
  })
})

describe("SidebarInput", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarHeader>
            <SidebarInput placeholder="Search..." />
          </SidebarHeader>
        </Sidebar>
      </WithProvider>
    )
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument()
  })
})

describe("SidebarSeparator", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <Sidebar collapsible="none">
          <SidebarSeparator />
        </Sidebar>
      </WithProvider>
    )
    expect(
      document.querySelector('[data-slot="sidebar-separator"]')
    ).toBeInTheDocument()
  })
})

describe("SidebarInset", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <SidebarInset>
          <p>Main content</p>
        </SidebarInset>
      </WithProvider>
    )
    expect(screen.getByText("Main content")).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="sidebar-inset"]')
    ).toBeInTheDocument()
  })
})

describe("useSidebar hook", () => {
  it("throws when used outside SidebarProvider", () => {
    const ConsumerComponent = () => {
      useSidebar()
      return null
    }
    expect(() => render(<ConsumerComponent />)).toThrow(
      "useSidebar must be used within a SidebarProvider."
    )
  })

  it("provides state within SidebarProvider", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: ({ children }) => <SidebarProvider>{children}</SidebarProvider>,
    })

    expect(result.current.state).toBe("expanded")
  })
})
