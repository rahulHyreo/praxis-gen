// Loads .env (repo-root + package-local) so drizzle-kit sees DATABASE_URL.
// Container/CI/shell env vars always win — see ./src/env.ts for the model.
import "./src/env.js"
import type { Config } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Bring the local stack up (docker/README.md), " +
      "or set it in docker/env/.env for host-mode tooling."
  )
}

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
} satisfies Config
