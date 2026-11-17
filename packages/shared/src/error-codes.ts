/**
 * Shared API error codes and the error envelope.
 *
 * docs/SPEC.md §38 fixes the wire shape for every API error:
 *
 *     { error: string, details?: unknown, code?: string }
 *
 * `error` is a human-readable message. `code` is a stable, machine-readable
 * token the web app may branch on — the one part of an error a client is
 * allowed to depend on. `details` carries structured context (a flattened
 * ZodError, for instance) and is never required.
 *
 * WHY THE CODES LIVE HERE, in packages/shared, rather than in apps/api: the
 * web app branches on them, so a code defined only on the server is a string
 * duplicated in two places that drift. §38 says shared error codes live in
 * packages/shared; this is that module.
 *
 * ADDING A CODE. Add the entry to API_ERROR_CODES below, in the change that
 * actually raises it. A code is a contract: once the web app branches on it,
 * renaming it is a breaking change. Do not pre-register codes for behaviour
 * that does not exist yet — an unraised code cannot be tested, so nothing
 * notices when it is wrong.
 *
 * Codes docs/SPEC.md names but this repository does not yet raise, with the
 * section and capability that will own each:
 *
 *   block_locked, week_locked, module_locked  §12  progression engine
 *   practice_locked                           §12  progression engine [v1]
 *   AI_SUGGESTION_UNRESOLVED                  §14.3 AI-assisted mode
 *   REASONING_INCOMPLETE                      §20  Reasoning Core
 *   GOVERNANCE_REASON_REQUIRED                §6   governance console
 *   PACK_VERSION_MISMATCH                     §5   domain packs
 *   EVALUATION_PENDING                        §18  reasoning evaluation
 *   CLOCK_ANCHOR_INVALID                      §17  attempts [v1]
 *
 * Each arrives with the change that raises it, not before.
 */

/**
 * Every error code this repository can currently return.
 *
 * Frozen so a code cannot be added at runtime, which would defeat the point of
 * a declared vocabulary.
 */
export const API_ERROR_CODES = Object.freeze({
  /**
   * A request body, query or param failed Zod validation.
   *
   * §38 requires a ZodError to become HTTP 422 with the flattened issues in
   * `details`. This is the only error code the bootstrap raises, because
   * validation is the only domain-independent failure the api has yet.
   */
  VALIDATION_FAILED: "VALIDATION_FAILED",

  /**
   * An unhandled exception reached the error middleware — a bug, not a client
   * mistake. The message is deliberately generic: §38's envelope goes to the
   * client, so an internal failure must not leak a stack trace or a database
   * error string into it.
   */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const)

/** A code from the declared vocabulary. */
export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/** The §38 error envelope, as it appears on the wire. */
export interface ApiErrorBody {
  error: string
  details?: unknown
  code?: string
}

/**
 * Build a §38 error envelope.
 *
 * Keeps the shape in one place so a route cannot invent a fourth field or
 * rename `error` to `message`. `details` is omitted from the object entirely
 * when not supplied, rather than serialised as `undefined`.
 */
export function apiError(
  message: string,
  code?: ApiErrorCode,
  details?: unknown
): ApiErrorBody {
  const body: ApiErrorBody = { error: message }
  if (code !== undefined) body.code = code
  if (details !== undefined) body.details = details
  return body
}

/** True when `value` is a code in the declared vocabulary. */
export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" &&
    (Object.values(API_ERROR_CODES) as string[]).includes(value)
  )
}
