import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { NavUser } from "./nav-user"
import { SidebarProvider } from "./sidebar"

const user = {
  name: "John Doe",
  email: "john@example.com",
  avatar: "/avatars/john.jpg",
}

function WithProvider({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe("NavUser", () => {
  it("renders without crashing", () => {
    render(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    expect(screen.getByText("John Doe")).toBeInTheDocument()
  })

  it("shows user name", () => {
    render(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    expect(screen.getByText("John Doe")).toBeInTheDocument()
  })

  it("shows user email", () => {
    render(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    expect(screen.getByText("john@example.com")).toBeInTheDocument()
  })

  it("renders avatar fallback", () => {
    render(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    // AvatarFallback renders "CN" as static text in nav-user
    expect(screen.getAllByText("CN").length).toBeGreaterThanOrEqual(1)
  })

  it("opens dropdown when trigger is clicked", async () => {
    const { user: userEvent } = renderWithUser(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    // The trigger button contains the avatar + name + email
    const trigger = screen.getAllByRole("button")[0]
    await userEvent.click(trigger)
    // Dropdown items become visible
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument()
  })

  it("shows menu items in dropdown", async () => {
    const { user: userEvent } = renderWithUser(
      <WithProvider>
        <NavUser user={user} />
      </WithProvider>
    )
    const trigger = screen.getAllByRole("button")[0]
    await userEvent.click(trigger)
    expect(screen.getByText("Account")).toBeInTheDocument()
    expect(screen.getByText("Billing")).toBeInTheDocument()
    expect(screen.getByText("Notifications")).toBeInTheDocument()
    expect(screen.getByText("Log out")).toBeInTheDocument()
  })
})
