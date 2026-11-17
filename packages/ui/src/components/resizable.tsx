"use client"

import * as React from "react"
import {
  Group as PanelGroupPrimitive,
  Panel as PanelPrimitive,
  Separator as SeparatorPrimitive,
  useDefaultLayout,
} from "react-resizable-panels"
import { HugeiconsIcon } from "@hugeicons/react"
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

// react-resizable-panels v4 wrapper. v4 renamed PanelGroup/PanelResizeHandle to
// Group/Separator and moved layout persistence into the useDefaultLayout hook,
// so `autoSaveId` here recreates the familiar shadcn prop on top of it.

type ResizablePanelGroupProps = React.ComponentProps<
  typeof PanelGroupPrimitive
> & {
  // When set, the group layout persists to localStorage under this id and is
  // restored on mount (shadcn-era autoSaveId behavior).
  autoSaveId?: string
}

function ResizablePanelGroup({
  autoSaveId,
  ...props
}: ResizablePanelGroupProps) {
  if (autoSaveId) {
    return <PersistentPanelGroup autoSaveId={autoSaveId} {...props} />
  }
  return <BarePanelGroup {...props} />
}

function PersistentPanelGroup({
  autoSaveId,
  ...props
}: ResizablePanelGroupProps & { autoSaveId: string }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId,
  })
  return (
    <BarePanelGroup
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      {...props}
    />
  )
}

function BarePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof PanelGroupPrimitive>) {
  return (
    <PanelGroupPrimitive
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof PanelPrimitive>) {
  return <PanelPrimitive data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> & {
  withHandle?: boolean
}) {
  return (
    <SeparatorPrimitive
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border transition-colors hover:bg-ring/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none data-[separator]:cursor-col-resize",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-6 w-3 shrink-0 items-center justify-center rounded-xs border bg-border">
          <HugeiconsIcon
            icon={DragDropVerticalIcon}
            className="size-2.5 text-muted-foreground"
          />
        </div>
      ) : null}
    </SeparatorPrimitive>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
