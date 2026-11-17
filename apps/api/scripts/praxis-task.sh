#!/bin/sh
# praxis-task: the one way to run anything inside the api image.
#
# The image is Bun-only (oven/bun:1.4-alpine): no Node, no pnpm, no tsx. Bun
# runs TypeScript directly, so each task below is the Bun form of a
# package.json script. When one of those scripts changes its entry file, change
# it here too.
#
#   praxis-task api [bun flags]   apps/api     start, dev (--watch), debug (--inspect=…)
#   praxis-task migrate           packages/db  db:migrate:run
#   praxis-task seed              packages/db  db:seed
#   praxis-task studio [flags]    packages/db  db:studio
#
# Every container job goes through here rather than an ad-hoc `docker run`, so
# each one gets the same layered env, network and volumes as the long-running
# services — the alternative is a job that works for whoever wrote the command
# and nobody else.
#
# Every task runs from its own package directory, as `pnpm --filter <pkg>`
# does, and execs, so Bun becomes the process that receives SIGTERM.
#
# Scoped to the jobs v2 has today. v1 additionally has `flow-bundles` and
# `sync`, both claims-specific; §44's pack-sync and the other scheduled jobs
# arrive with their own changes and add their verbs here.
set -eu

ROOT="${PRAXIS_ROOT:-/repo}"
task="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi

case "$task" in
  api) cd "$ROOT/apps/api" && exec bun "$@" src/index.ts ;;
  migrate) cd "$ROOT/packages/db" && exec bun src/scripts/migrate.ts "$@" ;;
  seed) cd "$ROOT/packages/db" && exec bun src/seed.ts "$@" ;;
  studio) cd "$ROOT/packages/db" && exec bunx --bun drizzle-kit studio "$@" ;;
  *)
    echo "usage: praxis-task api|migrate|seed|studio [args...]" >&2
    exit 2
    ;;
esac
