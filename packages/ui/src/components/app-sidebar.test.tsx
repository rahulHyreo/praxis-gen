import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "./app-sidebar"
import { SidebarProvider } from "./sidebar"
import { TooltipProvider } from "./tooltip"

function WithProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </TooltipProvider>
  )
}

describe("AppSidebar", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    // App sidebar is visible in the DOM
    expect(document.querySelector('[data-slot="sidebar"]')).toBeInTheDocument()
  })

  it("renders nav items", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    expect(screen.getAllByText("Inbox").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Drafts").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Sent").length).toBeGreaterThan(0)
  })

  it("renders user info", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    // shadcn username is "shadcn"
    expect(screen.getByText("shadcn")).toBeInTheDocument()
  })

  it("renders Acme Inc branding", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    expect(screen.getByText("Acme Inc")).toBeInTheDocument()
  })

  it("renders search input", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    expect(screen.getByPlaceholderText("Type to search...")).toBeInTheDocument()
  })

  it("renders Unreads switch label", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    expect(screen.getByText("Unreads")).toBeInTheDocument()
  })

  it("renders mail list items", () => {
    render(
      <WithProvider>
        <AppSidebar />
      </WithProvider>
    )
    // at least one mail name should be visible
    expect(screen.getByText("William Smith")).toBeInTheDocument()
  })
})
