import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

/**
 * Global test setup for apps/web.
 *
 * jsdom does not implement several browser APIs that Radix primitives and
 * layout-aware hooks rely on, so the minimum surface is polyfilled here.
 *
 * §43: no network in a web test. `lib/api.ts` is mocked per suite — that is
 * what routing every request through one module buys. Nothing here installs a
 * global fetch mock, so an unmocked request fails loudly rather than silently
 * hitting a real server.
 */

afterEach(() => {
  cleanup()
})

// matchMedia — used by theme-aware components and viewport hooks.
// Defined unconditionally (not behind an `if`) so vi.restoreAllMocks() in one
// test cannot strip the polyfill and leave later tests with undefined
// matchMedia.
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

// ResizeObserver — Radix primitives that measure their trigger need it.
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
})

// jsdom implements neither of these; Radix calls them on open/close.
Element.prototype.scrollIntoView = vi.fn()
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
}
