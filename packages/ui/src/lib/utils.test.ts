import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("")
  })

  it("concatenates class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes (truthy)", () => {
    // eslint-disable-next-line no-constant-binary-expression -- the `cond && "class"` idiom is the behaviour under test
    expect(cn("foo", true && "bar")).toBe("foo bar")
  })

  it("handles conditional classes (falsy)", () => {
    // eslint-disable-next-line no-constant-binary-expression -- the `cond && "class"` idiom is the behaviour under test
    expect(cn("foo", false && "bar")).toBe("foo")
  })

  it("handles undefined and null inputs without crashing", () => {
    expect(cn("foo", undefined, null)).toBe("foo")
  })

  it("merges conflicting Tailwind classes — last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("merges conflicting padding variants", () => {
    expect(cn("p-4", "p-2")).toBe("p-2")
  })

  it("de-conflicts text colour utilities", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("preserves non-conflicting classes", () => {
    const result = cn("flex", "items-center", "gap-2")
    expect(result).toBe("flex items-center gap-2")
  })

  it("handles object syntax", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo")
  })

  it("handles array syntax", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar")
  })

  it("handles mixed inputs", () => {
    const result = cn("base", { active: true, disabled: false }, ["extra"])
    expect(result).toContain("base")
    expect(result).toContain("active")
    expect(result).toContain("extra")
    expect(result).not.toContain("disabled")
  })
})
