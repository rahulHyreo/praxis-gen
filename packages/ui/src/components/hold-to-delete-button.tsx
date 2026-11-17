import * as React from "react"
import { createPortal } from "react-dom"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"
import { buttonVariants } from "@workspace/ui/components/button-variants"

type HoldToDeleteButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Fires once the button has been held down for `holdMs`. This — not
     * `onClick` — is the destructive action. `onClick` still forwards for
     * incidental needs (e.g. `stopPropagation`) and fires on every press.
     */
    onDelete: () => void
    /** Hold duration (ms) before the delete triggers. Default 1500. */
    holdMs?: number
    /** Hint shown when the button is clicked instead of held. */
    hint?: string
  }

/** Gap between the button edge and the hint bubble, in px. */
const HINT_GAP = 6
/** Room the bubble needs above the button before it flips below it, in px. */
const HINT_CLEARANCE = 32

/**
 * A delete button that requires a deliberate press-and-hold to fire, guarding
 * against accidental destructive clicks.
 *
 * - Press and hold for `holdMs` (default 1.5s) → `onDelete` fires once.
 * - Resting state is a light-red outline pill; a red "back light" fills the
 *   button left-to-right as a live progress bar and the border deepens to full
 *   red while held.
 * - Releasing early cancels the delete and surfaces a "Hold to delete" hint.
 *
 * The hint is **portalled to `document.body`** and positioned from the button's
 * viewport rect. It floats above the button, and every call site here is a row
 * in a table whose card clips (`overflow-hidden`) and whose header sticks at
 * `z-10` — so an in-flow bubble is painted over or cut off for the first row,
 * the one row whose bubble reaches up into the header band. Fixing that with a
 * z-index does not hold: this button is `isolate` (the -z-10 progress fill
 * needs it), which traps the bubble's own z-index inside the button. Leaving
 * the containing block entirely is the only version that survives any table.
 *
 * Mirrors the `Button` variant/size API so it drops into existing call sites.
 */
function HoldToDeleteButton({
  onDelete,
  holdMs = 1500,
  hint = "Hold to delete",
  variant = "ghost",
  size,
  className,
  children,
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  ...props
}: HoldToDeleteButtonProps) {
  const [holding, setHolding] = React.useState(false)
  const [showHint, setShowHint] = React.useState(false)
  const [hintPos, setHintPos] = React.useState<{
    left: number
    top: number
    below: boolean
  } | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = React.useRef(false)

  /**
   * Anchor the portalled bubble to the button's viewport rect. Flips below the
   * button when there is no room above it (a row scrolled up under a sticky
   * app header), so the hint is never off-screen.
   */
  const placeHint = React.useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = rect.top < HINT_CLEARANCE
    setHintPos({
      left: rect.left + rect.width / 2,
      top: below ? rect.bottom + HINT_GAP : rect.top - HINT_GAP,
      below,
    })
  }, [])

  const clearHold = React.useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const begin = React.useCallback(() => {
    if (disabled || holdTimer.current !== null) return
    firedRef.current = false
    setShowHint(false)
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null
      firedRef.current = true
      setHolding(false)
      onDelete()
    }, holdMs)
  }, [disabled, holdMs, onDelete])

  const end = React.useCallback(() => {
    const wasHolding = holdTimer.current !== null
    clearHold()
    setHolding(false)
    // Released before the hold completed → it was a click, not a hold.
    if (wasHolding && !firedRef.current) {
      placeHint()
      setShowHint(true)
      if (hintTimer.current !== null) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setShowHint(false), 1400)
    }
  }, [clearHold, placeHint])

  React.useEffect(
    () => () => {
      clearHold()
      if (hintTimer.current !== null) clearTimeout(hintTimer.current)
    },
    [clearHold]
  )

  // A portalled bubble does not travel with the row, so follow the anchor for
  // the ~1.4s it is up. Capture phase, because the scroll that moves the row is
  // the app shell's own scroll container, not the window.
  React.useEffect(() => {
    if (!showHint) return
    const reposition = () => placeHint()
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)
    return () => {
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [showHint, placeHint])

  const button = (
    <button
      ref={buttonRef}
      type="button"
      data-slot="hold-to-delete-button"
      data-holding={holding ? "true" : "false"}
      data-hint={showHint ? "true" : "false"}
      aria-keyshortcuts="Hold"
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size }),
        // Resting: light-red outline pill with red label/icon.
        "relative isolate overflow-visible border-destructive/40 text-destructive transition-all",
        "hover:border-destructive/70 hover:bg-destructive/5 hover:text-destructive",
        // Holding: border deepens to full red + a soft outer glow as the fill runs.
        "data-[holding=true]:border-destructive data-[holding=true]:text-destructive",
        "data-[holding=true]:shadow-[0_0_0_1px_var(--destructive),0_0_14px_-5px_var(--destructive)]",
        className
      )}
      onPointerDown={(e) => {
        begin()
        onPointerDown?.(e)
      }}
      onPointerUp={(e) => {
        end()
        onPointerUp?.(e)
      }}
      onPointerLeave={(e) => {
        end()
        onPointerLeave?.(e)
      }}
      onPointerCancel={(e) => {
        end()
        onPointerCancel?.(e)
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault()
          begin()
        }
        onKeyDown?.(e)
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          end()
        }
        onKeyUp?.(e)
      }}
      {...props}
    >
      {/* Red "back light" progress fill, clipped to the button shape. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
      >
        <span
          data-slot="hold-fill"
          className="absolute inset-y-0 left-0 w-full origin-left bg-destructive/25"
          style={{
            transitionProperty: "transform",
            transitionTimingFunction: "linear",
            transitionDuration: holding ? `${holdMs}ms` : "160ms",
            transform: holding ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </span>

      <span className="relative inline-flex items-center gap-1">
        {children}
      </span>
    </button>
  )

  return (
    <>
      {button}
      {/*
       * Quick-click hint bubble. Portalled out to `document.body` so no table
       * card, scroll container or sticky header can clip or cover it, and
       * `fixed` so it never shifts layout.
       */}
      {showHint &&
        hintPos !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="status"
            data-slot="hold-to-delete-hint"
            style={{
              left: hintPos.left,
              top: hintPos.top,
              transform: hintPos.below
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            }}
            className="pointer-events-none fixed z-70 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background shadow"
          >
            {hint}
          </span>,
          document.body
        )}
    </>
  )
}

export { HoldToDeleteButton }
export type { HoldToDeleteButtonProps }
