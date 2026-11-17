// Loads .env (repo-root + package-local) before anything reads process.env.
// Container/CI/shell env vars always win — see ./env.ts for the priority model.
import "./env.js"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema.js"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  // A warning, not a throw: `pnpm typecheck`, `pnpm test` and the api's
  // /api/health endpoint must all work with no database configured. Anything
  // that actually issues a query fails loudly at that point instead.
  console.warn(
    "[db] DATABASE_URL is not set — db operations will fail until configured"
  )
}

// One pool per process. The api is a long-lived server reached through the
// local compose stack, so ~10 connections is ample; DB_POOL_MAX exists so a
// deployment topology that multiplies processes (several replicas behind one
// managed Postgres, each keeping its own pool) can lower it without a code
// change. An out-of-range or non-numeric value falls back to the default
// rather than silently creating a 0- or NaN-sized pool.
const poolMax = Number(process.env.DB_POOL_MAX ?? 10)

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export const db = drizzle(pool, { schema })

export type Db = typeof db
