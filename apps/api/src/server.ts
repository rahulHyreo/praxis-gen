// LOAD-BEARING FIRST IMPORT — do not reorder, and do not let a formatter or an
// import-sorting rule move it.
//
// `express-async-errors` monkey-patches Express 4's Router so that a rejected
// promise from an `async` route handler is forwarded to the error-handling
// middleware. Without it Express 4 drops the rejection: the request HANGS, the
// client eventually times out, and nothing is logged. The patch has to be
// applied before any route module registers a handler, which is why this sits
// above every other import. docs/SPEC.md §38 requires it first.
import "express-async-errors"

import express, { type Express } from "express"
import cors from "cors"

import healthRouter from "./routes/health.js"
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js"

/**
 * Build the Express app.
 *
 * Separate from ./index.ts so that a test can mount the app with supertest
 * without binding a port or starting any background work.
 *
 * MIDDLEWARE ORDER IS PART OF THE CONTRACT (§38). The sequence is: body
 * parsing and CORS, then routes, then the 404 for unmatched API paths, then the
 * error handler last. Express picks an error handler only from those
 * registered after the middleware that threw, so moving the error handler up
 * silently stops it running.
 *
 * Later changes insert their middleware into this sequence — request logging,
 * the audit middleware, auth, the response cache — each in the position §38
 * gives it, not at the end for convenience.
 */
export function createServer(): Express {
  const app = express()

  app.use(express.json({ limit: "2mb" }))
  app.use(express.urlencoded({ extended: true }))

  // The web app is served from a different origin in host-mode development
  // (Vite on 5173, api on 3001), so credentialed cross-origin requests must be
  // allowed explicitly. WEB_URL is the single origin permitted; `credentials`
  // is required for cookie-based sessions to survive the preflight.
  const webUrl = process.env.WEB_URL
  app.use(
    cors({
      origin: webUrl ? [webUrl] : true,
      credentials: true,
    })
  )

  app.use("/api/health", healthRouter)

  // 404 for any other /api path, so an unknown route returns the §38 envelope
  // instead of Express's default HTML. Scoped to /api: a non-API path is not
  // this server's to claim.
  app.use("/api", notFoundHandler)

  // LAST. See the note above and ./middleware/error.middleware.ts.
  app.use(errorHandler)

  return app
}
