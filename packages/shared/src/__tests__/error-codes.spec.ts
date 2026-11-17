import { describe, expect, it } from "vitest"

// Imported through the package entry point, not from "../error-codes.js"
// directly. That is what a consumer does — `import { apiError } from
// "@platform/shared"` — so testing the barrel is testing the real contract,
// and a re-export dropped from index.ts fails here instead of at the first
// consumer.
import {
  API_ERROR_CODES,
  apiError,
  isApiErrorCode,
  type ApiErrorCode,
} from "../index.js"

describe("API_ERROR_CODES", () => {
  it("maps every key to itself, so a code is its own name on the wire", () => {
    // A code whose key and value differ is a trap: the server branches on one
    // spelling and the client sees the other.
    for (const [key, value] of Object.entries(API_ERROR_CODES)) {
      expect(value).toBe(key)
    }
  })

  it("has no duplicate values", () => {
    const values = Object.values(API_ERROR_CODES)
    expect(new Set(values).size).toBe(values.length)
  })

  it("exposes only stable SCREAMING_SNAKE_CASE string literals", () => {
    for (const value of Object.values(API_ERROR_CODES)) {
      expect(typeof value).toBe("string")
      expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/)
    }
  })

  it("is frozen, so a code cannot be added at runtime", () => {
    expect(Object.isFrozen(API_ERROR_CODES)).toBe(true)
  })

  it("does not pre-register a code this repository cannot raise", () => {
    // docs/SPEC.md names these, but the behaviour that raises each arrives in
    // a later change (see the module header). Registering one early gives the
    // web app something to branch on that the server never sends.
    const notYetOurs = [
      "block_locked",
      "week_locked",
      "module_locked",
      "practice_locked",
      "AI_SUGGESTION_UNRESOLVED",
      "REASONING_INCOMPLETE",
      "GOVERNANCE_REASON_REQUIRED",
      "PACK_VERSION_MISMATCH",
      "EVALUATION_PENDING",
      "CLOCK_ANCHOR_INVALID",
    ]
    const registered = Object.values(API_ERROR_CODES) as string[]
    for (const code of notYetOurs) {
      expect(registered).not.toContain(code)
    }
  })

  it("contains no pack vocabulary", () => {
    // §Non-negotiables: no domain-specific names in core code. A shared error
    // code naming a claim would put pack vocabulary in every client.
    const text = Object.keys(API_ERROR_CODES).join(" ").toLowerCase()
    for (const term of ["claim", "dcn", "pay", "deny"]) {
      expect(text).not.toContain(term)
    }
  })
})

describe("apiError", () => {
  it("returns the §38 envelope with just a message", () => {
    expect(apiError("Something went wrong")).toEqual({
      error: "Something went wrong",
    })
  })

  it("includes the code when given one", () => {
    expect(
      apiError("Invalid input", API_ERROR_CODES.VALIDATION_FAILED)
    ).toEqual({ error: "Invalid input", code: "VALIDATION_FAILED" })
  })

  it("includes details when given them", () => {
    const details = { fieldErrors: { email: ["Required"] } }
    expect(
      apiError("Invalid input", API_ERROR_CODES.VALIDATION_FAILED, details)
    ).toEqual({
      error: "Invalid input",
      code: "VALIDATION_FAILED",
      details,
    })
  })

  it("omits absent keys entirely rather than serialising undefined", () => {
    // `{ error, code: undefined }` serialises to `{"error":...,"code":null}`
    // through some encoders, which a client reading `code` cannot distinguish
    // from a real value.
    const body = apiError("Oops")
    expect(Object.keys(body)).toEqual(["error"])
    expect("code" in body).toBe(false)
    expect("details" in body).toBe(false)
  })

  it("preserves a falsy details value", () => {
    // 0, "" and false are legitimate details. Only `undefined` means absent.
    expect(apiError("Oops", API_ERROR_CODES.INTERNAL_ERROR, 0)).toHaveProperty(
      "details",
      0
    )
    expect(apiError("Oops", API_ERROR_CODES.INTERNAL_ERROR, "")).toHaveProperty(
      "details",
      ""
    )
    expect(
      apiError("Oops", API_ERROR_CODES.INTERNAL_ERROR, false)
    ).toHaveProperty("details", false)
  })
})

describe("isApiErrorCode", () => {
  it("accepts every declared code", () => {
    for (const value of Object.values(API_ERROR_CODES)) {
      expect(isApiErrorCode(value)).toBe(true)
    }
  })

  it("rejects an undeclared string", () => {
    expect(isApiErrorCode("NOPE")).toBe(false)
    expect(isApiErrorCode("block_locked")).toBe(false)
  })

  it("rejects non-string values", () => {
    for (const value of [undefined, null, 0, 1, {}, [], true]) {
      expect(isApiErrorCode(value)).toBe(false)
    }
  })

  it("narrows the type for the compiler", () => {
    const value: unknown = "VALIDATION_FAILED"
    if (isApiErrorCode(value)) {
      const narrowed: ApiErrorCode = value
      expect(narrowed).toBe("VALIDATION_FAILED")
    } else {
      throw new Error("expected the guard to accept a declared code")
    }
  })
})
