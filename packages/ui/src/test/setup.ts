import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

/**
 * Global test setup for `packages/ui`.
 *
 * jsdom does not implement several browser APIs that Radix UI primitives rely
 * on. We polyfill the minimum surface so component tests run without crashing.
 */

afterEach(() => {
  cleanup()
})

// matchMedia — used by `use-mobile` and theme-aware components.
// Always define (not guarded by `if`) so vi.restoreAllMocks() in individual tests
// cannot strip this polyfill and leave subsequent tests with undefined matchMedia.
function makeMatchMediaMock(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(makeMatchMediaMock),
})

// Re-install after each test in case vi.restoreAllMocks() stripped the mock
afterEach(() => {
  if (!window.matchMedia || typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(makeMatchMediaMock),
    })
  }
})

// ResizeObserver — used by Radix Popover/Select/Tooltip positioning.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// IntersectionObserver — used by some scroll-aware primitives.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ""
    thresholds = []
  } as unknown as typeof IntersectionObserver
}

// Pointer-capture + scrollIntoView — required by Radix Select/Dropdown menus.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
