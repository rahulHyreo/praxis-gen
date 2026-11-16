## Context

Praxis v2 is an empty repository: a specification, an OpenSpec scaffold, and no git history, package
graph, build, test runner or container stack. Nothing in §41 phases A–I can be built or verified
until that skeleton exists, and the git hooks that §Workflow designates as develop's CI cannot exist
until the repository is a git repository at all.

V1 is a working monorepo on the same declared stack (§1), with four months of production operation
behind its toolchain. Its scaffolding is therefore both the fastest and the lowest-risk starting
point — it already encodes fixes for failures v2 would otherwise rediscover. But V1 *is* the claims
platform: its schema, 47 services, 15 route modules, 24 web features and seven maintenance scripts
are saturated with claims vocabulary that §Non-negotiables bars from v2 core logic.

The design problem is not "how do we build a monorepo". It is **where to cut** between V1's
scaffolding and V1's content, and how to make that cut hold under pressure from every later change.

Constraints:

- §Layout fixes the directory shape. It is not open for redesign.
- §42 fixes the toolchain (pnpm 11.5.0, Node ≥ 20, Turbo, Bun images, layered env) and the command
  set. Its deployment half — Swarm, Jenkins, ACR, Ansible, previews — is **out of scope for this
  change by decision**: v2 only needs to run locally for now. §42 itself is not edited (D10).
- §43 fixes the testing conventions and names six guard tests, most of which depend on code that does
  not yet exist.
- §40 requires the v2 migration set to start fresh at `0000_init`; V1's migrations are not carried.
- §2 puts the build specification at `docs/SPEC.md`, which does not yet exist — the text is in
  `CLAUDE.md`, and `openspec/config.yaml` points at a third path.
- V1 must not be disturbed. §42 requires v2 to run as a separate stack, and locally that means a
  developer machine where both may be up at once.

## Goals / Non-Goals

**Goals:**

1. A workspace that installs, builds, lints, typechecks and tests green on a clean checkout, on
   Windows and Linux.
2. A **local** composed stack that comes up healthy under plain `docker compose` — no Swarm, no
   registry, no remote host — answers `GET /api/health` and renders the web shell.
3. The claims/core boundary machine-enforced from the first commit, not documented and hoped for.
4. Folder contracts established for §38 (api routes/services/middleware/lib) and §39 (strict MVVM
   feature folders), so later changes extend a structure instead of inventing one.
5. The specification at the one path §2 names, with every statement of precedence pointing there.
6. A `praxis2` stack that cannot touch a v1 stack's database, buckets, Redis keyspace or ports on the
   same developer machine.

**Non-Goals:**

- Any database schema. §40 starts fresh at `0000_init`; schema groups land with the changes that own
  them. `packages/db` ships a `Pool` singleton, `ids.ts` and an empty `drizzle/`.
- Authentication, roster, content, progression, workbench, assessment, reasoning, DRI, credentials —
  phases A (beyond this change) through I.
- Any §45.1 config surface or §45.3 governance value. This change introduces none, so nothing here
  needs a "not approved" badge.
- Pack content. `packs/` is four directories and four READMEs.
- `pnpm packs:validate` / `pnpm packs:sync`. §42 lists them; the validator that would back them does
  not exist, and a script resolving to nothing is worse than an absent one.
- `loadtest/`, `postman/`, `.github/workflows/e2e.yaml` — these target V1's claims endpoints.
- **Deployment, in every form.** No CI pipelines (`ci/jenkins/`), no provisioning (`ansible/`), no
  container registry, no remote host, no Swarm, no preview environments, no `remote-deploy.sh`, no
  nginx reverse-proxy configuration, and no env file for a deployed environment. The stack runs on a
  developer machine and nowhere else.
  §42's deployment path stays in `docs/SPEC.md` unedited — it is the eventual target, deferred rather
  than abandoned (D9).

## Decisions

### D1. Copy V1's scaffolding file-by-file; re-author nothing that already works

**Decision.** Carry V1's root configs, per-package tool configs, hooks, `lint-staged.config.mjs`,
`scripts/test-staged.mjs`, Vitest configs and `docker/` tree as the starting text, editing only what
v2 changes. Carry the explanatory comments verbatim.

**Why.** Several of these files are not expressions of taste; they are bug fixes with the
reproduction recorded in a comment. Three in particular:

- **`unset GIT_DIR GIT_INDEX_FILE` before Turbo.** Git exports `GIT_DIR` to hooks. In a linked
  worktree it points at `.git/worktrees/<name>` with no `GIT_WORK_TREE`, so the `git status` Turbo
  runs inside each package treats that package as the work-tree root; git hashing fails, Turbo falls
  back to manual hashing, and on Windows hangs forever before starting a task. This repository's
  primary platform is Windows. Re-authoring the hooks loses this and the symptom is an indefinite
  hang with no error.
- **`pool: "forks"` with `isolate: true` and an explicit heap ceiling.** A worker *thread* rejects
  `--max-old-space-size` in `execArgv` (`ERR_WORKER_INVALID_EXEC_ARGV`) and its heap sits in the
  parent's resident set, so with threads neither a ceiling nor a legible OOM is achievable. V1
  measured a monotonic ~340 MB-per-file climb and a kernel OOM kill at 32 minutes before this
  configuration.
- **`load-env.sh`'s read-loop.** POSIX `source` executes the file, so `FROM_NAME=Praxis Training
  Platform` runs `Training Platform` as a command and, under `set -e`, aborts the caller.

**Alternatives considered.** *Fresh scaffolding from `create-vite` / `create-turbo`*: produces a
tree that diverges from §Layout and discards all three fixes above. Rejected. *Fork the V1 git
repository and delete*: carries V1's full history and makes "what did v2 add" unanswerable; also
makes it easy to leave claims code in by forgetting to delete it. Rejected in favour of a fresh
history with an explicit copy list — the default is "absent", not "present".

### D2. Pin dependency versions to V1's resolved set

**Decision.** Take V1's versions for every shared dependency rather than resolving `latest`.

**Why.** V1's lockfile is a known-good resolution under production load. A fresh resolution would
pick versions no Praxis deployment has run, and any resulting breakage would be indistinguishable
from a bootstrap mistake. Upgrades become their own change with their own verification.

**Trade-off.** v2 starts slightly behind current releases. Acceptable: the alternative is debugging
an unrelated upgrade during the bootstrap.

**Two deliberate exceptions.** `apps/api` carries no `@sendgrid/mail` or `better-auth` yet (no email
or auth code to use them — they arrive with §7 and §36), and no `@aws-sdk/*` (no storage service yet
— §13). Installing a dependency with no importer is dead weight that the next person reads as a
signal.

### D3. The claims/core cut: copy configuration, never implementation

**Decision.** The cut is at **file role**, not file path. Copy a file if it configures the toolchain
or establishes a folder contract. Do not copy it if it implements behaviour, defines a schema, or is
a fixture.

Concretely, from V1: copy every `package.json`, `tsconfig*.json`, `eslint.config.js`,
`vitest*.config.ts`, `vite.config.ts`, `components.json`, `drizzle.config.ts`, `Dockerfile`,
`docker/**`, `.husky/**`, `lint-staged.config.mjs`, `scripts/test-staged.mjs` and the dotfiles.
Copy *none* of `packages/db/src/schema.ts`, `apps/api/src/{routes,services,data,emails}/**`,
`apps/web/src/features/**`, or V1's `drizzle/` migrations.

Dependency lists get the same treatment: V1's `apps/web` declares 30 runtime dependencies, of which
most are feature dependencies (`@vladmandic/face-api` for proctoring §25, `xlsx`/`exceljs`/`jspdf`
for reports §34, `pdfjs-dist`/`docx-preview` for document preview, `@dnd-kit`/`@xyflow/react`/
`@uiw/react-codemirror` for the bundle studio §10). Those are added by the change that imports them.
The bootstrap keeps React, React Router, Zustand, the TanStack trio, Zod, Sonner, `date-fns` and
`@workspace/ui`.

**Why this cut and not "copy and refactor later".** Refactoring claims vocabulary out of 47 services
is a larger job than writing the generalized services the specification already describes — and it
would be done against a schema that §40 says starts fresh anyway. Phases C–H exist to write these
properly.

**Alternative considered.** Copy the services and rename identifiers mechanically (`claim` →
`subject`, etc.). Rejected: it produces services shaped by v1's data model, importing tables that do
not exist, and would need rewriting to match §12's progression engine, §13's bundle guards and §18's
extended rubric regardless. A mechanical rename also passes the no-domain-names guard while leaving
the architecture claims-shaped, which is the failure mode §Non-negotiables is written against.

### D4. Land the no-domain-names guard in this change

**Decision.** `apps/api/src/__tests__/no-domain-names.test.ts` (§43) lands here, in the change that
copies from the claims platform.

**Why.** It is the one §43 guard whose dependency — core service folders — this change creates, and
the risk it guards is at its maximum precisely now. It makes D3 executable rather than aspirational:
after this change, leaking claims vocabulary into `apps/api/src/services/` fails a test rather than
relying on a reviewer noticing.

It also passes trivially today, which is the point: the floor is established while it is free, and
every later change inherits it.

The allow-list is a declared array in the test source, not a glob. Adding an entry is a visible
diff — that is the review surface §Non-negotiables needs.

**The other five §43 guards** (answer-key leak, `COMPLETION_TRIGGERS` parity, snapshot immutability,
AI auto-accept, HITRUST wording) each need code this change does not create. They are registered in
`TESTING.md` against their owning capability. A guard test with nothing to assert against is a test
that passes for the wrong reason.

### D5. Re-lock the coverage ratchet to v2's measurements

**Decision.** Carry §43's ratchet doctrine and the comment discipline; replace the threshold
*values* with v2's own measured readings, taken twice, with each floor set below the lower reading.

**Why.** V1's floors (api 69.7 / 88.9 / 92.3, web 60.2 / 73.3 / 86.6) measure V1's code. Copied into
a repository with a handful of smoke tests they either fail immediately — leaving a red suite and the
temptation to disable the gate — or force the suite to be shaped to satisfy them. Either outcome
destroys the ratchet on day one.

The margin-below-reading rule is carried because V1 learned it the expensive way: its web suite's
reading swings ~0.2 percentage points between identical runs, and a floor set on a reading failed the
next run by 0.01%. V1's comment recording this is carried.

**Measure with the command CI runs.** V1's notes record floors set from `vitest run --coverage` that
then failed under the sharded command CI actually used. The bootstrap's floors are measured with
`pnpm test`.

### D6. Separate the local stack at every layer — ports included

**Decision.** `praxis2` for the compose project, the network, the volume prefix, the local image tags
(`praxis2-api`, `praxis2-web`) and the Redis key prefix (`praxis2:`), with a distinct database name,
distinct buckets, and **published host ports in a distinct block**: Postgres 5433, MinIO 9010 with
console 9011, Redis 6380, api 3002, web 5174. All remain environment-driven, as in V1. §42 marked the
naming "(confirm)"; confirmed.

**Why.** §42 requires a separate stack during migration, and a developer machine is exactly where the
two will meet. Separation at only one layer is not separation: a shared Redis keyspace lets v2 serve
V1's cached responses, which hold whole API payloads keyed by user — a cross-stack data leak, not
just a stale read.

**Ports are the layer that matters most locally, and the one V1's naming scheme does not cover.** A
name collision fails loudly. A port collision does one of two things: refuse to start, or — when a
developer points `psql`, Drizzle Studio or a `.env` at `localhost:5432` — silently attach to the
*other* stack's database. The second is a data-loss path during migration, when V1 is the system of
record. Offsetting the published ports removes it; leaving the in-container ports alone keeps
§Layout's 3001/5173 free for a host `pnpm dev` beside the containers.

**Verified, not assumed.** A task brings both local stacks up on one machine and asserts no conflict
on project name, container name, network, volume, published port or keyspace.

### D7. Move the specification, do not copy it

**Decision.** `docs/SPEC.md` receives the specification text; `CLAUDE.md` is replaced by the Appendix
B starter in the same change; `openspec/config.yaml`'s context is corrected from "SPEC.md at the repo
root" to `docs/SPEC.md`; `docs/v1-SPEC.md` carries V1's specification with a header bounding its
authority to `[v1]` items.

**Why.** Three documents currently name three different locations for one specification, and the one
`openspec/config.yaml` names does not exist. A precedence rule pointing at a missing file is worse
than no rule, because agents follow it and silently fall through to the next authority. Moving rather
than copying means the repository is never in a two-copy state — §2 already says `CLAUDE.md` is
"narrower than this file on purpose", so a 58 KB `CLAUDE.md` contradicts the specification it
contains.

**Open point this surfaces.** §2 says `docs/SPEC.md`; the OpenSpec config says the repo root. §2 is
the specification, so §2 wins and the config is corrected. Flagged in the PR as a documentation
correction, not a decision.

### D8. Package shells establish folder contracts, not just green tasks

**Decision.** Each package ships the folders its specification section prescribes, with a README
stating the contract, even where the folder holds one placeholder file.

`apps/api`: `src/routes/`, `src/services/`, `src/middleware/`, `src/lib/`; `express-async-errors`
imported first (§38 requires it before any route). `apps/web`: `src/features/` with the
`model/` → `viewmodel/` → `view/` shape documented, `src/app/router.tsx` as the single route
registry, `src/lib/api.ts` as the single API access point (§39: views never call `api.*`).
`packages/db`: the `Pool` singleton, `src/ids.ts` with `ensureIdSequences()`, an empty tracked
`drizzle/`. `packages/shared`: the Zod entry point and the shared error-code module. `packages/ui`:
the shadcn component root and the design tokens locked to preset `b1aJCZWLY`.

**Why.** §39's strict MVVM and §38's conventions are the kind of rule that holds if the first file in
a folder already follows it and erodes if the first author has to invent the shape. The marginal cost
now is a few placeholder files; the cost of establishing it across 12 feature folders later is an
argument per folder.

### D9. Use plain compose, and delete Swarm rather than carry it dormant

**Decision.** Carry V1's **`local`** overlay plus `seed` and `debug`; do not carry `dev` or `prod`.
Move the `bridge` driver into the base file and drop every `deploy:` block, so no overlay needs to
override the network. Carry only `base.env` and `local.env`; not `dev.env`, `uat.env`, `prod.env`,
`preview.env`, `customer.env` or `lt.env`.

**Which overlay is "the local one" is not obvious, and the obvious guess is wrong.** V1 has both
`dev.yml` and `local.yml`, and `dev` reads like the developer overlay. It is not: `local.yml`'s own
header says it was forked from `dev.yml` precisely so local DX could change "without disturbing the
shared `dev` environment that CI deploys to remote hosts". `dev.yml` is a deployment target.
`local.yml` is the developer machine, and it already carries four things this change needs — the
bridge-network override, Redis published to the host for `redis-cli`, the `node_modules` shadowing
fix, and `CHOKIDAR_USEPOLLING`. Carrying `dev.yml` would have meant re-deriving all four.

**Why drop Swarm rather than keep the override.** A V1-shaped *base* file cannot be brought up on its
own at all: an `overlay` network requires an initialized Swarm, so `docker compose up -f
docker-compose.yml` fails on the network definition before any service starts. V1 lives with that
because `local.yml` overrides the driver back to `bridge`. With no Swarm consumer left in v2, the
override is pure indirection, and a base file that only works when an overlay rescues it is a trap
for whoever next brings up a subset of services.

**One thing is deliberately not carried from `local.yml`: its `sync` service.** It runs
`praxis-task sync`, the flow-bundle sync — claims-specific, and §44 replaces it with pack-sync. The
seed overlay covers what v2 has today.

The broader reason is that dormant infrastructure rots silently. A carried `remote-deploy.sh`
pointing at hosts that do not exist, a `prod.env` nobody loads, a `preview/` overlay nothing invokes
— none is exercised by any test or any developer, so none is known to work when deployment finally
arrives. It will be written against §42 then, with a working target to verify against. Carrying it
now buys the appearance of readiness and none of the substance.

**What is kept is the mechanism, not the instances.** `APP_ENV` selection and the three-layer env
precedence stay exactly as V1 has them, defaulting to `local`. Adding a deployed environment later is
then a data change — a new `<env>.env` — not a re-architecture.

**Alternative considered.** Carry everything and document what is unused. Rejected: it makes the
"Deliberately NOT copied" boundary meaningless, since the deployment surface is the largest single
block of V1 infrastructure, and it leaves a reader unable to tell which scripts are live.

### D10. Narrowing the change does not narrow the specification

**Decision.** `docs/SPEC.md` §42 is created with its full deployment path intact — Swarm, Jenkins,
Azure Container Registry, Ansible, preview environments, `PRAXIS_DEPLOY_ENABLED`. This change
implements only its local part and says so in `README.md`.

**Why.** The specification describes the v2 product across phases A–I; this change is one step in
Phase A. Editing §42 down to what one change implements would corrupt the authority every later
change is measured against, and would leave no record that deployment was ever the plan. The place to
record a narrowed scope is the change artifact and the README — not the specification.

The `container-stack` spec carries this as a requirement with a scenario asserting §42 is unedited,
so the distinction survives review rather than living in a commit message.

### D11. Drop V1's committed-secret trust model

**Decision.** No value that authenticates to anything beyond the developer's machine is committed.
`local.env` carries only obviously-local placeholder container credentials — a Postgres user and
password, MinIO root credentials. `docker/env/README.md` states that distinction and drops V1's
trust-model warning.

**Why.** V1 commits real credentials to tracked files: a live SendGrid API key, the Better Auth
signing secret, database and MinIO passwords. Its env README is explicit about the consequence —
"Treat repo read access as production root access" — and about git history being "the full disclosure
log". That is a defensible position for a repository whose access list is tightly held, but it is not
one v2 should inherit by accident, and this change is the only moment where avoiding it is free:
**v2 has no external credential yet.** No email provider, no cloud storage account, no auth secret.
The model can be dropped now at zero cost, or argued about later with secrets already in the
history — where the only real fix is a history rewrite.

**Why not commit nothing at all.** A stack that needs manual secret assembly before it starts is a
stack nobody runs, and the first thing a developer would do is write the values into a file anyway.
Localhost-only container credentials are not secrets in any meaningful sense — they authenticate one
container to another on a bridge network. Marking them plainly as placeholders is more honest than
pretending they are sensitive, and keeps `docker compose up` working on a fresh clone.

**Consequence for later changes.** The §7 auth port and the §36 email change will each introduce a
real secret. Each must put it in the gitignored layer, and the `container-stack` spec's "No external
credential is committed" scenario holds them to it.

### Config surfaces — none in this change

The design rule "name the config surface and table for every tunable value" has no application here:
this change introduces no tunable value. Every number it contains is infrastructure
(`--max-old-space-size`, Redis `maxmemory`, healthcheck intervals, Vitest fork counts and timeouts,
coverage floors) — operational limits, not platform behaviour. No §45.1 surface is created and no
§45.3 value is invented. The first change to introduce one declares its table and its flagged
default then.

The one value that *looks* like a tunable is the coverage threshold set. It is deliberately a literal
in `vitest.config.ts` rather than configuration: §43 makes it a ratchet whose every movement must be
reviewable in a diff with a justifying comment. Externalising it would let it be lowered without
review, which is the one thing the ratchet exists to prevent.

## Risks / Trade-offs

**[Claims vocabulary leaks in through comments, type names or fixtures]** → The no-domain-names guard
(D4) lands in this change and runs in both hooks. Its allow-list is a declared array, so absorbing a
violation requires a visible diff.

**[V1's coverage floors get copied along with the config files]** → D5 replaces the values explicitly,
and the spec carries a scenario asserting V1's specific numbers are absent. The ratchet comment
records the measured v2 reading and the command it was measured under.

**[A local tool silently attaches to V1's database]** → The real local hazard. D6 offsets every
published port, so `localhost:5432` remains V1's and `localhost:5433` is v2's; a task verifies both
stacks side by side on one machine. There is no deployment path in this change, so a v2 *deploy*
cannot disturb anything — the first real deploy happens under the deployment change with this
separation already in place.

**[Deployment is read as cancelled rather than deferred]** → D10 keeps §42 intact in `docs/SPEC.md`,
and the `container-stack` spec carries a scenario asserting it is unedited. `README.md` states the
distinction in words.

**[Dependency resolution drift]** → D2 pins to V1's resolved versions. Trade-off accepted: v2 starts
marginally behind current releases, and upgrades become their own verifiable change.

**[Windows-specific toolchain failure]** → The primary development platform is Windows, and two of
the three carried fixes (D1) are Windows-specific. Both hooks are exercised on Windows as an
acceptance task rather than assumed from V1's behaviour.

**[The bootstrap looks finished]** → `README.md` states plainly what does not exist (schema, auth,
content, trainee behaviour) and that this is a local stack with no deployment path at all. The
`container-stack` spec carries this as a requirement rather than leaving it to prose. There is
nothing to deploy *with*, which is itself the strongest guard.

**[Placeholder files are mistaken for real implementations]** → Each placeholder folder carries a
README naming the § section that will fill it and the capability that owns it. Same for the four
`packs/` directories.

**[`express-async-errors` import order is lost in a later refactor]** → §38 requires it first; a
reordering breaks async error handling silently, in production, under load. Noted in `apps/api`'s
entry point as a load-bearing comment; the change that adds real routes should consider a guard test
for it.

## Migration Plan

No data migration — there is nothing to migrate from. The V1 import job (§46) is its own change in
Phase C, and V1 remains the system of record for its own history.

Sequencing within this change matters in one respect: git initialisation and the hooks must land
before the first substantive commit, or the first commit bypasses the gate it is establishing. Order
is therefore: git init on `develop` → root toolchain → packages → hooks → verify the hooks actually
block a bad commit → docker → docs.

**Rollback.** The repository has no prior state and no deployment. Rollback is deleting the working
tree and starting again; no external system is touched. The V1 repository is read-only throughout —
files are copied out of it and nothing is written back.

## Open Questions

1. **Lockfile baseline.** Pinning to V1's resolved versions (D2) is the decision; whether to also
   copy `pnpm-lock.yaml` and prune it, or to resolve fresh against pinned ranges, is an
   implementation detail left to the apply step. Pruning is faster but can retain entries for
   packages v2 does not install.
2. **`packages/ui` component scope.** V1's `packages/ui` carries a substantial shadcn component set.
   The bootstrap needs the token stylesheet and enough components to render a shell. Whether to carry
   V1's full set now (ready for later changes, some unused meanwhile) or add components as changes
   need them is deferred to the apply step; the design leans toward carrying the full set, since
   these are generated shadcn primitives with no domain content and no behaviour to review.
3. **`praxis-task` wrapper surface.** Settled: migrate and seed, and nothing else. §44's new jobs
   arrive with their own changes, and V1's remote job scripts are not carried (D9).
4. **Where the §43 deferral register lives.** `TESTING.md` is the decision. If the guard list grows
   past a handful, it may be better held in `openspec/` beside the specs that own each guard. Revisit
   when the third guard is deferred.
5. **When deployment returns.** This change leaves no deployment path. Whether the deployment change
   reinstates V1's Swarm + Jenkins + ACR + Ansible stack as §42 describes it, or targets something
   simpler, is a decision for that change — it now has no carried-forward commitment either way. §42
   remains the specified target until a `[changed]` entry says otherwise.
