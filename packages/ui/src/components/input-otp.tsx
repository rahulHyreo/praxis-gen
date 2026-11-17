import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { HugeiconsIcon } from "@hugeicons/react"
import { MinusSignIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Segmented one-time-code field. A single real (visually hidden) input carries
 * the value, so autofill, paste, IME and the software keyboard all behave like
 * a normal text field; the slots are presentational boxes driven by context.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      // The upstream default ("increase-width") polls elementFromPoint on a
      // timer to dodge password-manager badges. Managers do not offer to fill a
      // `one-time-code` field, so the probe buys nothing and costs a permanent
      // interval — opt out, but leave it overridable via props.
      pushPasswordManagerStrategy="none"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const context = React.useContext(OTPInputContext)
  const slot = context?.slots?.[index]

  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive ? true : undefined}
      // Mirrors input.tsx: the same surface, focus ring and invalid ring, so a
      // segmented field reads as the same primitive as every other control.
      className={cn(
        "relative flex h-11 w-10 items-center justify-center rounded-2xl border border-transparent bg-input/50 text-base font-medium tabular-nums transition-[color,box-shadow,background-color] outline-none",
        "data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/30",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {slot?.char ?? slot?.placeholderChar ?? null}
      {slot?.hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <HugeiconsIcon
        icon={MinusSignIcon}
        className="size-3 text-muted-foreground"
        strokeWidth={2}
      />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
