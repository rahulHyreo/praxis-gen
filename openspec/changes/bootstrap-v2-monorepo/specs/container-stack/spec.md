## ADDED Requirements

### Requirement: Local compose stack and overlays

The repository SHALL define a **local** Docker Compose stack: a base of supporting services composed
with one or more overlays. [v1, narrowed]

`docker/docker-compose.yml` SHALL define Postgres 16, an S3-compatible object store (MinIO) and
Redis, each with a healthcheck, a named volume and a published host port. Overlays SHALL be:
`docker-compose.local.yml` (build and hot-reload api and web from the working tree),
`docker-compose.seed.yml` (one-shot database seed and bucket creation) and
`docker-compose.debug.yml` (Node inspector on the api).

The overlay carried SHALL be v1's **`local`** overlay, not its `dev` overlay. V1's `dev.yml` is the
shared environment CI deploys to remote hosts; `local.yml` is the developer-machine one, and it
already carries the local fixes this change needs.

The base network SHALL use the `bridge` driver and the compose files SHALL carry no `deploy:` keys.
V1 declares an `overlay` network and Swarm `deploy:` blocks in its *base* file and overrides the
network back to `bridge` in `local.yml`. In v2 the `bridge` driver moves into the base file and the
override disappears [changed]: with no Swarm consumer left there is nothing for an overlay network to
serve, and a base file that cannot be brought up on its own is a trap. Swarm concerns are
reintroduced by the change that adds deployment, not carried dormant here.

Redis SHALL be configured with a memory ceiling and `allkeys-lru` eviction, so a spike evicts cold
cache entries rather than killing the container. The empty-password branch in its healthcheck SHALL
be retained, so a local container with no password set still reports healthy. Redis SHALL be
published on the host, as v1's `local.yml` does, so `redis-cli` can inspect keys.

V1's one-shot `sync` service SHALL NOT be carried: it runs the flow-bundle sync, which is
claims-specific and becomes pack-sync (§44) in a later change. The seed overlay covers what v2 has
today.

#### Scenario: Base stack comes up with plain compose

- **WHEN** a developer runs `docker compose up` against the base file on a machine with **no Swarm
  initialized**
- **THEN** Postgres, the object store and Redis all start and reach a healthy state, each reporting
  healthy through its own healthcheck rather than by container liveness alone

#### Scenario: Local overlay runs the apps from the working tree

- **WHEN** the base file is composed with the local overlay and brought up
- **THEN** the api and web containers run from the working tree with hot reload, and a source edit is
  reflected without an image rebuild

#### Scenario: No Swarm-only construct remains

- **WHEN** the compose files are inspected
- **THEN** no network uses the `overlay` driver, no service carries a `deploy:` block, and no overlay
  needs to override the base file's network driver

#### Scenario: Redis survives a spike without dying

- **WHEN** Redis reaches its configured memory ceiling
- **THEN** it evicts least-recently-used keys and keeps serving, rather than being killed for
  exceeding memory

#### Scenario: No claims-specific service is carried

- **WHEN** the compose files are inspected
- **THEN** no `sync` service running a flow-bundle sync is present

### Requirement: Hot reload works through a Windows bind mount

The local overlay SHALL set `CHOKIDAR_USEPOLLING=true` and a polling interval on both the api and web
containers, and the web Vite configuration SHALL read that variable and enable `server.watch.usePolling`.
[v1]

This is load-bearing on this repository's primary platform. WSL2 and DrvFs bind mounts do not
propagate inotify events into a Linux container, so `tsx watch` and Vite would never observe a host
edit: the stack would start, appear healthy, and silently stop reflecting changes.

The overlay SHALL also preserve the in-image `node_modules` against the host bind mount, using a
named volume for the workspace root and an anonymous volume per package, carrying v1's naming
rationale: a named volume is seeded from the image only while empty, so the name encodes the
installer layout to stop a stale layout being carried forward.

#### Scenario: A host edit reaches the container

- **WHEN** the stack is up with the local overlay on Windows and a source file is edited on the host
- **THEN** the api reloads and the web app hot-updates, without a rebuild or restart

#### Scenario: Host node_modules does not shadow the image's

- **WHEN** the stack is brought up with the local overlay on a host whose package `node_modules`
  directories are empty or symlinked
- **THEN** the container's own installed dependencies remain visible, and the build and dev tooling
  inside the container resolve

### Requirement: Layered committed environment files

Configuration SHALL be layered committed env files, later overriding earlier: `base.env` (non-secret
defaults) → `local.env` (local overrides) → optional `.env` (gitignored secrets). Selection SHALL
remain by the `APP_ENV` shell variable, defaulting to `local`. [v1, narrowed]

Only `base.env` and `local.env` SHALL be carried. V1's `dev.env`, `uat.env`, `prod.env`,
`preview.env`, `customer.env` and `lt.env` describe deployed environments that do not exist for v2
and SHALL NOT be created; the layering *mechanism* is kept so adding one later is a data change.

#### Scenario: Later layer wins

- **WHEN** `base.env` and `local.env` both set the same key, and the stack is brought up
- **THEN** the value from `local.env` is the one the container sees

#### Scenario: Missing secrets file is not an error

- **WHEN** the stack is brought up with no `docker/env/.env` present
- **THEN** compose starts normally, treating that layer as optional

#### Scenario: Only local env files exist

- **WHEN** `docker/env/` is listed
- **THEN** it contains `base.env`, `local.env` and a README, and no file describing a deployed
  environment

### Requirement: V1's committed-secret trust model is not carried

No value that authenticates to a system outside the developer's machine SHALL be committed to this
repository. Such values belong only in the gitignored `.env` layer, and v2 has none of them yet:
there is no email provider, no cloud storage account and no authentication secret in this change.
[changed]

V1 commits real credentials to tracked env files — a SendGrid API key, a Better Auth secret, database
and MinIO passwords — and its `docker/env/README.md` states the consequence plainly: "Treat repo read
access as production root access." That model MUST NOT be carried into v2.

The committed `local.env` MAY carry credentials that exist only to let the local containers talk to
each other — a Postgres user and password, MinIO root credentials — because they authenticate nothing
beyond `localhost` and a stack that needs manual secret assembly before it starts is a stack nobody
runs. Such values SHALL be obviously local, non-production placeholders, and `docker/env/README.md`
SHALL state that distinction and SHALL NOT repeat v1's trust-model warning, since v2's committed
files no longer earn it.

`docker/env/.env` SHALL be gitignored.

#### Scenario: No external credential is committed

- **WHEN** the committed env files are inspected
- **THEN** none contains an API key, token, cloud account key or authentication signing secret

#### Scenario: Local placeholder credentials are marked as such

- **WHEN** `local.env` and `docker/env/README.md` are read
- **THEN** the local container credentials are present, are recognizable as non-production
  placeholders, and the README states they authenticate nothing beyond the developer's machine

#### Scenario: The v1 trust-model warning is absent

- **WHEN** `docker/env/README.md` is read
- **THEN** it does not state that repository read access equals production root access, because no
  committed v2 file grants it

#### Scenario: The secrets layer is ignored by git

- **WHEN** `docker/env/.env` is created locally
- **THEN** `git status` does not list it and `git check-ignore` confirms it is ignored

### Requirement: Environment loading survives values containing spaces

`docker/load-env.sh` SHALL carry v1's read-loop implementation and its comment. This is
load-bearing: POSIX `source` executes the file, so an unquoted value containing a space runs its tail
as a command and, under `set -e`, aborts the caller. The read-loop passes each `KEY=VALUE` line to
`export` as a single argument.

#### Scenario: A value containing spaces survives loading

- **WHEN** an env file sets a key whose value contains spaces and `load-env.sh` is sourced
- **THEN** the full value is exported intact and no part of it is executed as a command

#### Scenario: Loading a layered set exports every key

- **WHEN** `load-env.sh` is sourced with `base.env`, `local.env` and no `.env` present
- **THEN** every key from both files is exported into the shell, the later file's value winning on a
  duplicate, and the absent layer causes no error

### Requirement: Locally built application images

`apps/api/Dockerfile` and `apps/web/Dockerfile` SHALL build on `oven/bun:1.4-alpine` and SHALL be
built locally. No registry, no image push and no remote host are involved. [v1, narrowed]

Every container job SHALL run through the `praxis-task` wrapper rather than an ad-hoc `docker run`,
so env layering, network and volume attachment are applied identically to every job. The wrapper
SHALL cover the jobs v2 has today — database migrate and seed — and no more.

`.vscode/tasks.json` SHALL expose the local stack and container-job tasks, so the documented
developer path is a task rather than a remembered command line.

#### Scenario: Images build locally

- **WHEN** both application images are built on a developer machine
- **THEN** each builds on the Bun base image, the resulting container starts, and no registry
  authentication is required at any point

#### Scenario: Container jobs go through the wrapper

- **WHEN** the database migrate or seed job is run against the local stack
- **THEN** it is invoked through `praxis-task`, receiving the same layered env, network and volumes
  as the long-running services

#### Scenario: No remote deployment path is carried

- **WHEN** `docker/` is listed
- **THEN** it contains no remote-deploy, sync-remote, host-nginx, preview or registry script, and no
  compose overlay for a deployed environment

### Requirement: The v2 local stack cannot collide with v1's

A developer machine may already run the v1 local stack. The v2 stack SHALL therefore be separable at
every layer that can collide on one host: compose project name, container names, network name, volume
names, **published host ports**, database name, object-storage bucket names and Redis keyspace.
§42 [changed]

§42 marked the naming "(confirm)"; it is confirmed. Locally built images SHALL be tagged
`praxis2-api` and `praxis2-web`; the compose project and network SHALL be named `praxis2`; volumes
SHALL be `praxis2`-prefixed; the Redis key prefix SHALL be `praxis2:`; and the database name SHALL
be distinct from v1's.

Published host ports SHALL default to a block distinct from v1's and SHALL remain environment-driven,
so a developer can move them without editing a compose file. Defaults: Postgres 5433, MinIO 9010 with
console 9011, Redis 6380, api 3002, web 5174, Drizzle Studio 4984. In-container ports are unchanged,
so §Layout's host-process dev ports — api 3001, web 5173 — stay available for a `pnpm dev` run
alongside the containers.

Port separation is the layer that matters most locally: a name collision fails loudly, whereas a port
collision either refuses to start or, worse, silently attaches a tool to the other stack's database.

#### Scenario: Both local stacks run side by side

- **WHEN** the v1 and v2 local stacks are both brought up on one developer machine
- **THEN** both reach a healthy state, with no conflict on compose project name, container name,
  network name, volume name, published port or Redis keyspace

#### Scenario: v2 cannot reach v1 data

- **WHEN** the v2 api is inspected for its resolved configuration
- **THEN** its database URL, bucket names and Redis prefix all name v2 resources, and none resolves
  to a v1 resource

#### Scenario: Cache keys cannot collide

- **WHEN** v1 and v2 are pointed at the same Redis instance
- **THEN** every v2 key carries the `praxis2:` prefix, so neither stack can read or evict the other's
  cached responses

#### Scenario: Ports are overridable without editing compose

- **WHEN** a developer sets a different `POSTGRES_PORT` in `docker/env/.env` and brings the stack up
- **THEN** Postgres publishes on that port, and no compose file was edited

#### Scenario: Host dev servers keep their specified ports

- **WHEN** the container stack is up and `pnpm dev` is run on the host
- **THEN** the api binds 3001 and web binds 5173 per §Layout, neither already taken by a container

### Requirement: Bucket names reflect packs, not flows

Object storage SHALL be configured with `S3_PACKS_BUCKET` for authored pack content, replacing v1's
`S3_FLOWS_BUCKET`, and SHALL carry `S3_PUBLIC_BUCKET` unchanged for trainee-facing media. §42, §10
[changed]

#### Scenario: Pack bucket is created by the seed overlay

- **WHEN** the stack is brought up with the seed overlay
- **THEN** `S3_PACKS_BUCKET` and `S3_PUBLIC_BUCKET` both exist in the local object store

#### Scenario: The v1 flows bucket name is absent

- **WHEN** the committed env files and application configuration are searched for `S3_FLOWS_BUCKET`
- **THEN** no occurrence is found

### Requirement: No fixed display time zone in the environment

The container stack and committed env files SHALL NOT pin a display time zone. Display time zone is
per market and per cohort (§7 [changed]), resolved by the application, so an environment-level
default would be a second, competing source of truth.

#### Scenario: No environment-level time zone default

- **WHEN** the committed env files and compose files are searched for a display time-zone setting
- **THEN** none sets `Asia/Kolkata`, `America/New_York` or any other display zone as a global default

### Requirement: Local only, and documented as such

This change SHALL produce a stack that runs on a developer machine: it comes up with plain
`docker compose`, serves `GET /api/health` and renders the web shell. It SHALL NOT produce anything
deployable — no CI pipeline, no provisioning automation, no registry, no remote host, no Swarm.

§42's deployment path (Docker Swarm, Jenkins, Azure Container Registry, Ansible, preview
environments) remains the specification's target and SHALL NOT be deleted from `docs/SPEC.md`. It is
deferred, not abandoned. `README.md` SHALL state that distinction explicitly, so a reader can tell a
narrowed scope from a changed plan.

#### Scenario: Health check answers on the local stack

- **WHEN** the stack is brought up with the local overlay and `GET /api/health` is requested through
  it
- **THEN** it responds 200

#### Scenario: The local-only boundary is documented

- **WHEN** `README.md` is read
- **THEN** it states that this change delivers a local Docker stack only, that CI, provisioning,
  registry and Swarm deployment are deferred to a later change, and that §42 still describes the
  eventual deployment target

#### Scenario: The specification keeps its deployment section

- **WHEN** `docs/SPEC.md` §42 is read
- **THEN** it still describes the full deployment path, unedited by this change
