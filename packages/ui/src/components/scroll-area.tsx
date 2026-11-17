"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Scrollable region with a styled scrollbar.
 *
 * ── The one trap worth knowing ──────────────────────────────────────────────
 * Radix gives the viewport `height: 100%`. A percentage height only resolves
 * against a parent with a DEFINITE height, so this scrolls when the Root's
 * height is pinned — `h-full`, `h-72`, or `flex-1` inside a container that
 * has a real `h-` — and silently does NOT when the only constraint is a
 * `max-h-*` somewhere up the chain. In that case the viewport collapses to
 * `auto`, grows past its container, and the content is clipped with no
 * scrollbar and no way to reach the bottom.
 *
 * That is why a Sheet body (`SheetContent` is `inset-y-0`, definite) scrolls
 * with plain `min-h-0 flex-1`, while the same markup inside a `DialogContent`
 * that only sets `max-h-[85vh]` does not.
 *
 * Two ways out, both used in this codebase:
 *   - give the dialog a definite height (`h-[85vh]`), or
 *   - cap the viewport instead of the Root:
 *     `*:data-[slot=scroll-area-viewport]:max-h-[60vh]` — which keeps the box
 *     shrinking to fit short content.
 */
function ScrollArea({
  className,
  children,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /**
   * Which scrollbars to render. Defaults to `"vertical"` so existing usages are
   * unchanged; pass `"horizontal"` or `"both"` for wide content like data tables.
   * Radix only shows a scrollbar when that axis actually overflows.
   */
  orientation?: "vertical" | "horizontal" | "both"
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          // Radix sets `display: table` on the viewport's inner wrapper so children
          // can grow wider than the viewport — required for horizontal scrolling.
          // For vertical-only scrolls that traps flex rows at their natural width
          // and clips them inside narrow containers (e.g. side sheets), so force
          // `block` and clear the table min-width when horizontal scroll isn't needed.
          orientation === "vertical" &&
            "[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(orientation === "vertical" || orientation === "both") && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === "horizontal" || orientation === "both") && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border hover:bg-foreground/30"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
