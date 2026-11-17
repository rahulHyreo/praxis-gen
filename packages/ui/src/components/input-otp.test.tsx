import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"

const REGEXP_ONLY_DIGITS = "^\\d+$"

/**
 * The field is controlled everywhere it is used (the login viewmodel owns the
 * value), so the harness mirrors that rather than testing the uncontrolled path.
 */
interface ControlledProps {
  initial?: string
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  inputMode?: "numeric" | "text"
  autoComplete?: string
  "data-testid"?: string
}

function Controlled({ initial = "", onComplete, ...props }: ControlledProps) {
  const [value, setValue] = useState(initial)
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      aria-label="One-time code"
      {...props}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  )
}

function slots(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="input-otp-slot"]')
  )
}

function slotText(container: HTMLElement) {
  return slots(container)
    .map((s) => s.textContent ?? "")
    .join("")
}

function hiddenInput(): HTMLInputElement {
  return screen.getByLabelText("One-time code") as HTMLInputElement
}

describe("InputOTP", () => {
  it("renders one slot per index plus the separator", () => {
    const { container } = render(<Controlled />)

    expect(slots(container)).toHaveLength(6)
    expect(container.querySelector('[role="separator"]')).toBeInTheDocument()
  })

  it("exposes a single real input that owns the value", () => {
    render(<Controlled initial="12" />)

    const input = hiddenInput()
    expect(input).toHaveValue("12")
    expect(input.tagName).toBe("INPUT")
  })

  it("renders the controlled value into the slots", () => {
    const { container } = render(<Controlled initial="123456" />)

    expect(slotText(container)).toBe("123456")
  })

  it("leaves slots past the value empty", () => {
    const { container } = render(<Controlled initial="12" />)

    expect(slotText(container)).toBe("12")
    expect(slots(container)[2]).toHaveTextContent("")
  })

  it("fills slots as the user types", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled />)

    await user.click(hiddenInput())
    await user.keyboard("123")

    expect(slotText(container)).toBe("123")
  })

  it("marks the next empty slot active while focused", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled />)

    await user.click(hiddenInput())
    await user.keyboard("12")

    expect(slots(container)[2]).toHaveAttribute("data-active", "true")
  })

  it("removes the last digit on backspace", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled initial="123" />)

    await user.click(hiddenInput())
    await user.keyboard("{Backspace}")

    expect(slotText(container)).toBe("12")
  })

  it("clears every digit with repeated backspaces", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled initial="12" />)

    await user.click(hiddenInput())
    await user.keyboard("{Backspace}{Backspace}")

    expect(slotText(container)).toBe("")
  })

  it("fills all six slots from a single paste", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled />)

    await user.click(hiddenInput())
    await user.paste("123456")

    expect(slotText(container)).toBe("123456")
  })

  it("stops accepting input at maxLength", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled />)

    await user.click(hiddenInput())
    await user.keyboard("1234567890")

    expect(slotText(container)).toBe("123456")
    expect(hiddenInput()).toHaveValue("123456")
  })

  it("rejects non-digits when a digits-only pattern is set", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled />)

    await user.click(hiddenInput())
    await user.keyboard("12ab34")

    expect(slotText(container)).toBe("1234")
  })

  it("calls onComplete when the last slot is filled", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Controlled initial="12345" onComplete={onComplete} />)

    await user.click(hiddenInput())
    await user.keyboard("6")

    expect(onComplete).toHaveBeenCalledWith("123456")
  })

  it("does not call onComplete before the code is complete", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Controlled onComplete={onComplete} />)

    await user.click(hiddenInput())
    await user.keyboard("12345")

    expect(onComplete).not.toHaveBeenCalled()
  })

  it("accepts no input while disabled", async () => {
    const user = userEvent.setup()
    const { container } = render(<Controlled disabled />)

    expect(hiddenInput()).toBeDisabled()
    await user.click(hiddenInput())
    await user.keyboard("123")

    expect(slotText(container)).toBe("")
  })

  it("forwards autofill and keyboard hints to the real input", () => {
    render(
      <Controlled
        inputMode="numeric"
        autoComplete="one-time-code"
        data-testid="otp"
      />
    )

    const input = hiddenInput()
    expect(input).toHaveAttribute("inputmode", "numeric")
    expect(input).toHaveAttribute("autocomplete", "one-time-code")
  })

  it("focuses the real input on autoFocus", () => {
    render(<Controlled autoFocus />)

    expect(hiddenInput()).toHaveFocus()
  })

  it("merges a caller class into the container and the slots", () => {
    const { container } = render(
      <InputOTP
        maxLength={2}
        containerClassName="custom-container"
        aria-label="One-time code"
      >
        <InputOTPGroup className="custom-group">
          <InputOTPSlot index={0} className="custom-slot" />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
      </InputOTP>
    )

    expect(container.querySelector(".custom-container")).toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="input-otp-group"]')
    ).toHaveClass("custom-group")
    expect(slots(container)[0]).toHaveClass("custom-slot")
  })

  it("carries the destructive ring when the field is marked invalid", () => {
    const { container } = render(
      <InputOTP maxLength={2} aria-label="One-time code">
        <InputOTPGroup>
          <InputOTPSlot index={0} aria-invalid />
          <InputOTPSlot index={1} aria-invalid />
        </InputOTPGroup>
      </InputOTP>
    )

    for (const slot of slots(container)) {
      expect(slot).toHaveAttribute("aria-invalid", "true")
      expect(slot.className).toContain("aria-invalid:border-destructive")
    }
  })

  it("renders a slot outside any InputOTP without crashing", () => {
    // Defensive: the context is empty, so the slot must not read through null.
    const { container } = render(<InputOTPSlot index={0} />)

    expect(slots(container)).toHaveLength(1)
    expect(slots(container)[0]).toHaveTextContent("")
  })

  it("renders a slot index that has no matching value position", () => {
    const { container } = render(
      <InputOTP maxLength={2} aria-label="One-time code">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={9} />
        </InputOTPGroup>
      </InputOTP>
    )

    expect(slots(container)[1]).toHaveTextContent("")
  })
})
