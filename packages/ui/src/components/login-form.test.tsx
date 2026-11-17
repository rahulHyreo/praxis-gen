import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { renderWithUser } from "../test/render"
import { LoginForm } from "./login-form"

describe("LoginForm", () => {
  it("renders without crashing", () => {
    const { container } = render(<LoginForm />)
    expect(container.querySelector("form")).toBeInTheDocument()
  })

  it("renders email input", () => {
    render(<LoginForm />)
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
  })

  it("renders password input", () => {
    render(<LoginForm />)
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
  })

  it("renders Login submit button", () => {
    render(<LoginForm />)
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument()
  })

  it("renders GitHub login button", () => {
    render(<LoginForm />)
    expect(
      screen.getByRole("button", { name: /login with github/i })
    ).toBeInTheDocument()
  })

  it("renders forgot password link", () => {
    render(<LoginForm />)
    expect(
      screen.getByRole("link", { name: /forgot your password/i })
    ).toBeInTheDocument()
  })

  it("renders sign up link", () => {
    render(<LoginForm />)
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument()
  })

  it("accepts className", () => {
    const { container } = render(<LoginForm className="custom-form" />)
    expect(container.querySelector("form")).toHaveClass("custom-form")
  })

  it("allows typing in email field", async () => {
    const { user } = renderWithUser(<LoginForm />)
    const emailInput = screen.getByLabelText("Email")
    await user.type(emailInput, "test@example.com")
    expect(emailInput).toHaveValue("test@example.com")
  })

  it("allows typing in password field", async () => {
    const { user } = renderWithUser(<LoginForm />)
    const passwordInput = screen.getByLabelText("Password")
    await user.type(passwordInput, "secret123")
    expect(passwordInput).toHaveValue("secret123")
  })

  it("fires onSubmit when form is submitted", () => {
    const handler = vi.fn((e: React.FormEvent) => e.preventDefault())
    const { container } = render(<LoginForm onSubmit={handler} />)
    const form = container.querySelector("form")!
    fireEvent.submit(form)
    expect(handler).toHaveBeenCalled()
  })
})
