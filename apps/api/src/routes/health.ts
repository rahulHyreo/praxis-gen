import { Router, type Request, type Response } from "express"

import { API_BUILD_ID, API_BUILD_TIME } from "../lib/build-info.js"

/**
 * GET /api/health — liveness.
 *
 * Answers 200 with **no** database connection, no authentication and no pack
 * content, deliberately (docs/SPEC.md §44). It is what the container
 * healthcheck and `docker compose` wait on, so making it depend on Postgres
 * would mean the api reports unhealthy for reasons that are not about the api,
 * and a slow database would look like a failed deploy.
 *
 * A readiness endpoint that *does* probe dependencies is a separate concern and
 * belongs to the change that has dependencies worth probing.
 */
export const healthRouter = Router()

healthRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    build: API_BUILD_ID,
    buildTime: API_BUILD_TIME,
    uptimeSeconds: Math.round(process.uptime()),
  })
})

export default healthRouter
