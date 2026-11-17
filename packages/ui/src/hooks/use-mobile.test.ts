import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useIsMobile } from "./use-mobile"

function makeMatchMediaMock(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe("useIsMobile", () => {
  const originalInnerWidth = Object.getOwnPropertyDescriptor(
    window,
    "innerWidth"
  )

  beforeEach(() => {
    // Ensure matchMedia is always properly mocked before each test
    window.matchMedia = makeMatchMediaMock(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalInnerWidth) {
      Object.defineProperty(window, "innerWidth", originalInnerWidth)
    }
  })

  function setWindowWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    })
  }

  it("returns false when window width is >= 768 (desktop)", () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns true when window width is < 768 (mobile)", () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("returns false at exactly the breakpoint (768px)", () => {
    setWindowWidth(768)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns true at 767px (one below breakpoint)", () => {
    setWindowWidth(767)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("registers and cleans up a matchMedia change listener", () => {
    const addEventListenerSpy = vi.fn()
    const removeEventListenerSpy = vi.fn()

    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
    })

    setWindowWidth(1024)
    const { unmount } = renderHook(() => useIsMobile())

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    )
  })

  it("updates when matchMedia fires a change event", () => {
    let changeHandler: (() => void) | null = null

    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        changeHandler = handler
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })

    setWindowWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      setWindowWidth(375)
      changeHandler?.()
    })

    expect(result.current).toBe(true)
  })
})
