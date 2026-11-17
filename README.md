# Praxis v2

A configurable healthcare-operations training and certification platform. Its
launch configuration is the **Claims Operations** track: three four-week blocks —
Foundations, then the Compliance Passport fused with the Reasoning Core, then a
domain pack — plus an optional employer overlay of up to four weeks.

Praxis v1's claims content becomes v2's first domain pack. Claims is the first
pack, not the architecture.

## State of this repository

**Bootstrapped only.** Five packages build, lint, typecheck and test; a local
Docker stack runs Postgres, MinIO and Redis; the api answers `GET /api/health`
and the web app renders a shell.

There is **no** schema (`docs/SPEC.md` §40 starts the migration set fresh at
`0000_init`), no authentication, no content, no progression, no workbench, no
assessments and no trainee-facing behaviour. Nothing here can be put in front of
a user.

There is also **no deployment path of any kind** — no CI, no provisioning, no
container registry, no remote host, no Swarm. That is a deliberately narrowed
scope, not a changed plan: §42 still describes the eventual deployment target
(Docker Swarm, Jenkins, Azure Container Registry, Ansible, preview
environments), and it is deferred to its own change. The specification was not
edited down to match what is built.

`packages/db/src/schema.ts` maps every §40 table group to the §41 phase that
adds it. It is the fastest way to see where a change belongs.

## Getting started

Requires Node ≥ 20, Docker, and nothing else — pnpm pins itself.

```bash
pnpm install        # resolves pnpm 11.5.0 first, via packageManager + .npmrc
pnpm build
pnpm test
```

Then bring up the local stack. The documented path is a VS Code task
(`.vscode/tasks.json`): **stack:up**, **db:init**, **health**, **stack:down**.
By hand, and for everything the stack does, see [`docker/README.md`](docker/README.md).

Two ways to run the apps:

|                                                                                 | api                     | web                     |
| ------------------------------------------------------------------------------- | ----------------------- | ----------------------- |
| **In Docker** (`stack:up`)                                                      | <http://localhost:3002> | <http://localhost:5174> |
| **On the host** (`pnpm dev`, services in Docker via `stack:up (services only)`) | <http://localhost:3001> | <http://localhost:5173> |

Both at once is fine — the container ports deliberately avoid the host ones.
Note that the **api container does not hot-reload** on a Windows bind mount
(`bun --watch` misses bind-mount changes); the web container does.
`docker/README.md` explains and gives both workarounds.

Every v2 port, volume, network and image is `praxis2`-named and distinct from
v1's, so both stacks can run on one machine. That matters more than it sounds:
pointing `psql` at `localhost:5432` out of habit reaches **v1**, which is the
system of record during migration.

## Commands

```bash
pnpm dev | build | lint | lint:fix | format | format:fix | format:check
pnpm typecheck | test | test:db | test:root
pnpm db:push | db:generate | db:migrate | db:migrate:run | db:deploy
pnpm db:seed | db:studio | dev:setup
```

`pnpm test` runs each package's suite through Turbo with the coverage gate, then
the repo-level tooling suite. `pnpm test:db` runs the api's database suites
against an in-memory PGlite — no Docker, no Postgres, no `TEST_DATABASE_URL`.
See [`TESTING.md`](TESTING.md).

`pnpm packs:validate` and `pnpm packs:sync` are specified in §42 but **not yet
declared**: the pack validator does not exist, and a script name that resolves
to nothing is worse than an absent one.

## Layout

```text
apps/web          React 19 + Vite 7 + Tailwind v4 + shadcn/ui, React Router v7,
                  Zustand, TanStack Form/Table      (host dev port 5173)
  src/features/   one folder per feature, strict MVVM (§39)
  src/app/        router.tsx — every route, role guards, shells
  src/lib/api.ts  the single point of API access
apps/api          Express 4 + Drizzle                (host dev port 3001)
  src/routes/     route modules
  src/services/   business logic — no pack vocabulary, guard-enforced
  src/middleware/ order is part of the contract (§38)
packs/            authored domain-pack content (§5) — data, not a package
  foundations/ compliance/ reasoning-generic/ claims/
packages/db       Drizzle schema, Pool singleton, ID helpers, seed, drizzle/
packages/shared   Zod schemas + shared constants     (@platform/shared)
packages/ui       shadcn components + design tokens  (@workspace/ui)
docker/           the local stack
docs/             SPEC.md (authority) + v1-SPEC.md (reference)
openspec/         change proposals, specs and tasks
```

## How to work here

Read `CLAUDE.md` first — it is the short version of the rules and points at the
sections worth reading before you build.

**Precedence:** code > `docs/SPEC.md` > `openspec/specs/` > `docs/v1-SPEC.md`
(only for items `docs/SPEC.md` marks `[v1]`) > design documents. **When docs and
code disagree, trust the code.**

Feature work runs through OpenSpec: propose → apply → archive, one domain per
change. See `openspec/changes/`.

Branch is **`develop`**; never commit straight to it. Conventional commit
prefixes: `feat`, `fix`, `schema`, `api`, `ui`, `store`, `seed`, `test`,
`chore`, and `pack` for domain-pack content.

**The git hooks are `develop`'s CI.** There is no pipeline running lint, format,
typecheck or test — `.husky/pre-commit` covers the staged files and the
typecheck, `.husky/pre-push` covers the whole tree with the coverage gate. Never
`--no-verify` onto `develop`.

Coverage is a **ratchet**: raise a threshold, never lower it, and record the
measurement in the comment. `TESTING.md` explains why the floors sit below their
readings rather than on them.

## Non-negotiables

The full list is in `CLAUDE.md` and `docs/SPEC.md`. The ones most likely to be
violated by accident:

- **Domain content is pack configuration.** No `claim`/`DCN`/`pay`/`deny` in
  core services — `apps/api/src/__tests__/no-domain-names.test.ts` enforces it.
- **No hard-coded pass marks, weights, DRI formulas, thresholds, caps,
  durations or progression rules.** They live in the §45.1 config surfaces. A
  value needing governance ships as config with a default marked "not approved".
- **Scores, DRI results and credential decisions are snapshotted at write**, not
  re-derived at read time. Those rows are append-only.
- **Progression, eligibility, scoring, visibility and RBAC are server-side.**
  The UI renders the returned lock reason verbatim.
- **A `NULL` decision is a valid _correct_ answer**, not a missing one.
- **No real PHI. No pricing or billing.**
