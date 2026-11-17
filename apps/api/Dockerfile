# syntax=docker/dockerfile:1.7
# Dockerfile for @platform/api.
#
# Runs on Bun, not Node. Bun executes the TypeScript sources directly and
# resolves the workspace deps (@platform/db, @platform/shared) through
# apps/api/tsconfig.json `paths`, so there is no tsc step. The image carries no
# Node, pnpm or tsx: everything it runs goes through
# apps/api/scripts/praxis-task.sh (installed as `praxis-task`).
#
# BUILT LOCALLY. No registry, no push, no remote host — docs/SPEC.md §42
# describes the eventual deployment path and it is deferred (see this change's
# proposal). There is therefore no `prod` stage yet: adding one without a
# target to deploy it to would ship an untested stage.
#
# BUN_VERSION names the 1.4 line, not a patch release, so a rebuild picks up
# the newest 1.4.x.
ARG BUN_VERSION=1.4

FROM oven/bun:${BUN_VERSION}-alpine AS base
# Bun below 1.4.4 bundles a Brotli decoder with an out-of-bounds write
# (CVE-2026-111497), reachable through fetch()'s automatic `br` decoding and
# node:zlib. The tag floats, but a builder can still hold an older cached 1.4
# image: refuse to build on one rather than ship it.
RUN bun -e 'if (!Bun.semver.satisfies(Bun.version, ">=1.4.4")) { console.error(`Bun ${Bun.version} is older than 1.4.4 (CVE-2026-111497): pull oven/bun:1.4-alpine again`); process.exit(1) }'
# Alpine's security fixes land before the base image is rebuilt with them.
RUN apk upgrade --no-cache
WORKDIR /repo
ENV CI=true

# ----- deps: install the workspace, with a cache mount -----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
# pnpm-lock.yaml stays the lockfile of record. With no bun.lock in the repo,
# `bun install` migrates it in memory and installs exactly the versions it
# pins; --frozen-lockfile fails the build instead of resolving anything new
# when package.json and the lockfile disagree. That matters here more than
# usual: every dependency is exact-pinned at v1's resolved version
# (this change's decision D2), and a silent re-resolution would undo that.
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
# After the install, so editing the script does not re-run it.
COPY --chmod=0755 apps/api/scripts/praxis-task.sh /usr/local/bin/praxis-task

# ----- dev: source bind-mounted by compose, runs bun --watch -----
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3001 4983
# Source is volume-mounted by docker-compose.local.yml; node_modules stays
# in-image behind anonymous volumes.
#
# On boot: apply pending migrations (the runner waits for Postgres), start
# Drizzle Studio in the background, then exec the api under `bun --watch` as
# PID 1. Studio binds 0.0.0.0:4983 so the port forward works; drizzle-kit
# reflects that host into the hosted-UI URL, so open it via
#   https://local.drizzle.studio/?host=localhost&port=4984
#
# Migration and Studio failures are tolerated rather than fatal: a transiently
# unhealthy database should not crash the container, and the api surfaces a
# clearer error on first request. There are no migrations yet in any case (§40).
CMD ["sh", "-c", "praxis-task migrate || echo '[dev] migrate failed (continuing — check logs and re-run the db:migrate task)'; (praxis-task studio --host 0.0.0.0 --port 4983 || echo '[dev] drizzle studio failed (continuing)') & exec praxis-task api --watch"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
