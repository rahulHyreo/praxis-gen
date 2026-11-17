import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./resizable"

function renderGroup(props: { autoSaveId?: string } = {}) {
  return render(
    <ResizablePanelGroup {...props}>
      <ResizablePanel id="left" minSize="100px">
        left
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="right">right</ResizablePanel>
    </ResizablePanelGroup>
  )
}

describe("Resizable", () => {
  it("renders panels and separator", () => {
    const { container, getByText } = renderGroup()
    expect(getByText("left")).toBeInTheDocument()
    expect(getByText("right")).toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="resizable-handle"]')
    ).toBeInTheDocument()
  })

  it("has data-slot attributes on group and panels", () => {
    const { container } = renderGroup()
    expect(
      container.querySelector('[data-slot="resizable-panel-group"]')
    ).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-slot="resizable-panel"]')
    ).toHaveLength(2)
  })

  it("separator has role=separator for keyboard a11y", () => {
    const { container } = renderGroup()
    expect(container.querySelector('[role="separator"]')).toBeInTheDocument()
  })

  it("renders with autoSaveId (persistent layout path)", () => {
    const { getByText } = renderGroup({ autoSaveId: "test-layout" })
    expect(getByText("left")).toBeInTheDocument()
  })
})
