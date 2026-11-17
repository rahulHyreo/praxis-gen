# The local stack

**Local only.** Postgres, MinIO and Redis, plus the api and web from your
working tree. No Swarm, no registry, no remote host, no CI.
`docs/SPEC.md` §42 describes the eventual deployment path; it is deferred, not
abandoned.

The documented path is a VS Code task (`.vscode/tasks.json`) — `stack:up`,
`stack:down`, `db:init`, `health` and the rest. Every compose invocation needs
both `--env-file` flags and the right `-f` chain, and getting either wrong
fails in a way that looks like a broken stack rather than a wrong command.

By hand:

```bash
docker compose \
  --env-file docker/env/base.env --env-file docker/env/local.env \
  -f docker/docker-compose.yml -f docker/docker-compose.local.yml \
  up -d --build
```

Or, to run the api and web on the host with `pnpm dev` and only the services in
Docker, drop the second `-f`.

## Files

| File                       | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `docker-compose.yml`       | base: Postgres 16, MinIO, Redis. Bridge network, no `deploy:` keys. |
| `docker-compose.local.yml` | api + web from source, hot reload, the `node_modules` shadowing fix |
| `docker-compose.seed.yml`  | one-shot migrate + seed + bucket create (`--profile seed`)          |
| `docker-compose.debug.yml` | adds the Bun inspector to the api                                   |
| `env/`                     | the three env layers — see `env/README.md`                          |
| `load-env.sh`              | source the same layers into a host shell                            |

## Ports

A block distinct from v1's, so both stacks can run on one machine.

| Service         | v2 host port            | v1          |
| --------------- | ----------------------- | ----------- |
| Postgres        | **5433**                | 5432        |
| api (container) | **3002**                | 3001        |
| web (container) | **5174**                | 8080        |
| Drizzle Studio  | **4984**                | 4983        |
| MinIO           | **9010** / console 9011 | 9000 / 9001 |
| Redis           | **6380**                | 6379        |
| Bun inspector   | 6500                    | —           |

In-container ports are unchanged, which leaves §Layout's host-process ports
(api 3001, web 5173) free for a plain `pnpm dev` beside the containers.

**This separation matters more than the naming.** A name collision fails
loudly; a port collision either refuses to start or — when you point `psql`,
Drizzle Studio or a `.env` at `localhost:5432` — silently attaches you to v1's
database. During migration v1 is the system of record, so that is a data-loss
path. Override any port in `docker/env/.env` without editing a compose file.

## Things worth knowing

### Hot reload: web yes, api no

**The web container hot-reloads. The api container does not.** Verified on
Windows, not assumed.

`CHOKIDAR_USEPOLLING=true` is set on both, and `apps/web/vite.config.ts` reads
it — WSL2 and DrvFs bind mounts deliver no inotify events, so without polling
Vite would never see your edits. With it, an edit under `apps/web/src` produces
an HMR update in about five seconds.

It does nothing for the api. `CHOKIDAR_*` is a **chokidar** setting, honoured by
Vite and `tsx`; the api runs on `bun --watch`, whose watcher is neither and has
no polling mode. The bind mount is not the problem — the container reads your
edited bytes immediately — Bun just never notices they changed. Nothing errors;
the endpoint simply keeps serving the old code, which is the worst shape a
failure can take.

Two working paths after editing `apps/api`:

```bash
# restart the container (a few seconds)
docker compose --env-file docker/env/base.env --env-file docker/env/local.env \
  -f docker/docker-compose.yml -f docker/docker-compose.local.yml restart api

# or run the api on the host, with a real watcher
pnpm --filter @platform/api dev
```

The second is why the port block leaves 3001 and 5173 free (see Ports above):
bring up the services with the base file only, and run the api and web on the
host with `pnpm dev`.

**`node_modules` is protected from the bind mount.** A named volume for the
workspace root and an anonymous volume per package keep the in-image installs
visible; otherwise the host's (often empty, or Windows-symlinked) folders win
and the tooling disappears inside the container.

**Every container job goes through `praxis-task`** (`apps/api/scripts/`), not an
ad-hoc `docker run`, so each gets the same layered env, network and volumes as
the long-running services. Verbs today: `api`, `migrate`, `seed`, `studio`.

**The seed is idempotent and non-destructive.** v1's TRUNCATEs, which is why its
deploy orchestrator needs a four-rule safety model; v2's is additive by contract
(`packages/db/src/seed.ts`), so `db:init` is safe to re-run. It currently
inserts nothing and applies no migrations — §40 starts the migration set fresh
at `0000_init` — and it is wired now so the change that adds the first table
isn't debugging compose at the same time.

**Health is deliberately shallow.** `GET /api/health` answers 200 with no
database, auth or pack dependency (§44). The container healthcheck waits on it,
so making it probe Postgres would mean the api reports unhealthy for reasons
that are not about the api.

## What is not here

`nginx.conf`, `host-nginx.conf`, `remote-deploy.sh`, `sync-remote.sh`,
`preview/`, the `prod` and `dev` overlays, and the `uat`/`prod`/`preview`
env files. All are v1's remote-deployment surface. Carrying them would ship
untested scripts pointing at hosts that do not exist, and dormant
infrastructure rots silently — nothing exercises it, so nothing reveals that it
stopped working. It is written against §42 when there is a target to verify
against.

v1's one-shot `sync` service is also absent: it runs the claims flow-bundle
sync. `pnpm packs:sync` (§44) replaces it and arrives with the packs capability.
