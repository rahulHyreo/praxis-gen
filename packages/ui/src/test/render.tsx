import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"

/**
 * Renders a UI primitive and returns a configured `user-event` instance
 * alongside the standard Testing Library queries.
 */
export function renderWithUser(
  ui: ReactElement,
  options?: RenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  return {
    user: userEvent.setup(),
    ...render(ui, options),
  }
}

export * from "@testing-library/react"
export { default as userEvent } from "@testing-library/user-event"
