import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"
import { API_ERROR_CODES, type ApiErrorBody } from "@platform/shared"

/**
 * An error a route may throw to choose its own status and code.
 *
 * Throwing is how a route signals failure: `express-async-errors` (imported
 * first in ../server.ts) forwards a rejected promise here, so a handler never
 * has to thread an error through `next()`.
 */
export interface ApiError extends Error {
  status?: number
  details?: unknown
  code?: string
}

/**
 * The single error handler. docs/SPEC.md §38 fixes its output shape:
 *
 *     { error, details?, code? }
 *
 * and requires a ZodError to become **422**, not 400 — a validation failure is
 * a well-formed request the server understood and refused, which is what 422
 * means.
 *
 * Register it LAST, after every route. Express selects an error handler by
 * arity (four parameters), and only considers those registered after the
 * middleware that threw.
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  // Required: Express identifies an error handler by its four-parameter
  // signature. Dropping this makes it an ordinary middleware that never runs
  // for an error — silently.
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: "Validation failed",
      code: API_ERROR_CODES.VALIDATION_FAILED,
      details: err.issues,
    }
    res.status(422).json(body)
    return
  }

  const status = typeof err.status === "number" ? err.status : 500

  // A 5xx is a bug, so its message must not reach the client: an exception
  // string can carry a query, a path or a connection string. A route that
  // wants to explain a failure sets `status` below 500 deliberately.
  const body: ApiErrorBody =
    status >= 500
      ? { error: "Internal server error", code: API_ERROR_CODES.INTERNAL_ERROR }
      : { error: err.message || "Request failed" }

  if (status < 500) {
    if (err.details !== undefined) body.details = err.details
    if (err.code) body.code = err.code
  }

  // Log every 5xx with its route so it is greppable in `docker compose logs`.
  if (status >= 500) {
    console.error(`[api] ${status} ${req.method} ${req.originalUrl} —`, err)
  }

  res.status(status).json(body)
}

/**
 * 404 for an unmatched path under /api.
 *
 * Registered after the routes and before the error handler, so an unknown API
 * path returns the §38 envelope rather than Express's default HTML page.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = { error: `Not found: ${req.method} ${req.path}` }
  res.status(404).json(body)
}
