#!/usr/bin/env sh
# Local helper: source the layered env files into the current shell so
# `docker compose ...` calls without --env-file resolve their interpolation,
# and so host-mode tooling (pnpm dev, drizzle-kit) sees the same values.
#
#   cd <repo root>
#   . docker/load-env.sh
#   docker compose -f docker/docker-compose.yml -f docker/docker-compose.local.yml up -d
#
# Order matches the compose files: base.env → <env>.env → .env, later winning.
#
# WHY A READ LOOP AND NOT `set -a; . file; set +a`: POSIX `source` EXECUTES the
# file, so an unquoted value containing a space runs its tail as a command —
# `SENDGRID_FROM_NAME=Praxis Training Platform` would try to run
# "Training Platform" and, under `set -e`, abort the caller. This loop passes
# each KEY=VALUE line to `export` as a single argument, so spaces survive and
# nothing is executed.

_load_one() {
  [ -f "$1" ] || return 0
  while IFS= read -r __env_line || [ -n "$__env_line" ]; do
    case "$__env_line" in '' | \#*) continue ;; esac
    export "$__env_line"
  done < "$1"
}

_load_one docker/env/base.env
_load_one "docker/env/${APP_ENV:-local}.env"
_load_one docker/env/.env
unset __env_line
unset -f _load_one
