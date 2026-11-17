# syntax=docker/dockerfile:1.7
# Dockerfile for the web app.
#
# The build runs on Bun (`bun --bun` runs Vite on Bun itself). BUN_VERSION
# names the 1.4 line, not a patch release.
#
# BUILT LOCALLY, and `dev` is the only stage. docs/SPEC.md §42's deployment
# path — a static build served by nginx behind a reverse proxy — is deferred
# (see this change's proposal), and nginx is not carried: a `prod` stage with
# nowhere to deploy it and nothing exercising it would be an untested stage
# that looks ready. `pnpm build` produces the static bundle for anyone who
# wants to check the production build locally.
ARG BUN_VERSION=1.4

FROM oven/bun:${BUN_VERSION}-alpine AS base
# Bun below 1.4.4 bundles a vulnerable Brotli decoder (CVE-2026-111497); see
# apps/api/Dockerfile. Refuse to build on an older cached 1.4 image.
RUN bun -e 'if (!Bun.semver.satisfies(Bun.version, ">=1.4.4")) { console.error(`Bun ${Bun.version} is older than 1.4.4 (CVE-2026-111497): pull oven/bun:1.4-alpine again`); process.exit(1) }'
RUN apk upgrade --no-cache
WORKDIR /repo
ENV CI=true

# ----- deps -----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
# See apps/api/Dockerfile: pnpm-lock.yaml is the lockfile of record and
# --frozen-lockfile keeps the exact-pinned versions (decision D2) intact.
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ----- dev: Vite with HMR, source bind-mounted by compose -----
FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /repo/apps/web
EXPOSE 5173
# --host 0.0.0.0 so the published port reaches it from the host. HMR over a
# bind mount additionally needs CHOKIDAR_USEPOLLING, which
# docker-compose.local.yml sets and vite.config.ts reads — without it a host
# edit is never observed on Windows.
CMD ["bunx", "--bun", "vite", "--host", "0.0.0.0"]
