## ADDED Requirements

### Requirement: Workspace membership and layout

The repository SHALL be a pnpm workspace whose members are `apps/*` and `packages/*`, with exactly
five packages at bootstrap: `apps/web`, `apps/api`, `packages/db`, `packages/shared` and
`packages/ui`. The repository SHALL additionally carry a `packs/` content root that is NOT a
workspace member, because authored pack content is data, not a compiled package. This layout is
[v1], carried per §Layout, with `packs/` as the [new] addition.

Package names SHALL be `web`, `@platform/api`, `@platform/db`, `@platform/shared` and
`@workspace/ui`. Every package SHALL be `private: true` and `type: "module"`.

#### Scenario: Workspace resolves every member

- **WHEN** `pnpm install` runs at the repository root
- **THEN** all five packages are linked, `@platform/db`, `@platform/shared` and `@workspace/ui`
  resolve from `apps/api` and `apps/web` via `workspace:*` ranges, and no package is fetched from a
  registry in place of its workspace copy

#### Scenario: packs/ is content, not a package

- **WHEN** `pnpm install` runs
- **THEN** `packs/` is not installed as a workspace package, carries no `package.json`, and contains
  the four launch pack directories `foundations/`, `compliance/`, `reasoning-generic/` and `claims/`

#### Scenario: Pack directories declare their own scope

- **WHEN** a developer opens any directory under `packs/`
- **THEN** it carries a README naming its §4.3 week range and stating that its authored content
  arrives in a later change, so an empty directory is not mistaken for missing work

### Requirement: TypeScript project graph

The repository SHALL compile as a single TypeScript project graph. The root `tsconfig.json` SHALL
declare `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true` and
`skipLibCheck: true`; SHALL declare path aliases for `@platform/db`, `@platform/db/*`,
`@platform/shared`, `@platform/shared/*`, `@workspace/ui` and `@workspace/ui/*` resolving to each
package's `src`; and SHALL reference all five packages while emitting nothing itself (`files: []`).
[v1]

Each package SHALL own a `tsconfig.json` that extends the root compiler options. No package SHALL
weaken `strict`.

#### Scenario: Workspace typechecks clean

- **WHEN** `pnpm typecheck` runs at the repository root
- **THEN** Turbo runs `tsc --noEmit` for every package and all five exit zero

#### Scenario: Cross-package import resolves by alias

- **WHEN** `apps/api` imports a symbol from `@platform/shared` and `apps/web` imports one from
  `@workspace/ui`
- **THEN** both typecheck and build without a relative path traversal (`../../packages/...`) in the
  import specifier

#### Scenario: Strictness cannot be locally disabled

- **WHEN** any package's `tsconfig.json` is inspected
- **THEN** none sets `strict: false`, `noImplicitAny: false` or an equivalent relaxation, and no
  source file in the bootstrap uses the `any` type

### Requirement: Turbo task graph

The repository SHALL drive all per-package work through Turbo. `turbo.json` SHALL define the tasks
`build`, `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`, `test`, `test:db`, `db:generate`,
`db:migrate`, `db:migrate:run`, `db:deploy`, `db:push`, `db:seed`, `db:studio`, `dev:setup` and
`dev`. [v1]

`build` SHALL depend on upstream `build` and declare `dist/**` as its output. `test` SHALL depend on
upstream `build` and declare `coverage/**`. Every `db:*` task and `dev:setup` SHALL set
`cache: false`, because they act on a live database and a cached replay would be a lie. `dev` SHALL
be `persistent` and uncached.

#### Scenario: Build order follows the dependency graph

- **WHEN** `pnpm build` runs at the repository root
- **THEN** `packages/shared`, `packages/db` and `packages/ui` build before `apps/api` and `apps/web`,
  and no package builds before a package it imports

#### Scenario: Database tasks are never replayed from cache

- **WHEN** `pnpm db:push` runs twice against the same tree with no file changes
- **THEN** the task executes both times and Turbo reports no cache hit for it

#### Scenario: A clean tree replays from cache

- **WHEN** `pnpm typecheck` runs twice with no file changes between runs
- **THEN** the second run is satisfied from Turbo's cache and completes without re-invoking `tsc`

### Requirement: Root command set

The repository root SHALL expose the §42 command set, each delegating to Turbo except where it is
inherently repository-wide: `dev`, `build`, `lint`, `lint:fix`, `format`, `format:fix`,
`format:check`, `typecheck`, `test`, `test:db`, `db:push`, `db:generate`, `db:migrate`,
`db:migrate:run`, `db:deploy`, `db:seed`, `db:studio`, `dev:setup`. [v1]

`format:check` and `format:fix` SHALL run Prettier across the whole repository from the root rather
than per package, so that files outside any package — root configs, `packs/**`, `docs/**` — are
covered. `test` SHALL run with `--concurrency=1` so that per-package suites do not oversubscribe
memory when run together.

A command SHALL NOT be declared unless it resolves to a working implementation. The §42 commands
`packs:validate` and `packs:sync` are therefore NOT declared by this change; they are declared by
the change that implements the pack validator.

#### Scenario: Every declared root script runs

- **WHEN** each script declared in the root `package.json` is invoked on a clean checkout after
  `pnpm install`
- **THEN** none fails with a missing-binary, missing-task or unresolved-script error

#### Scenario: Formatting covers non-package files

- **WHEN** a root-level config file, a file under `packs/` and a file under `docs/` are each
  misformatted and `pnpm format:check` runs
- **THEN** the command fails and names all three files

#### Scenario: Unimplemented commands are absent, not broken

- **WHEN** the root `package.json` scripts are inspected
- **THEN** `packs:validate` and `packs:sync` are absent rather than present-and-failing

### Requirement: Package shells are runnable, not empty

Each of the five packages SHALL contain the minimum source for its own `build`, `lint`, `typecheck`
and `test` tasks to pass, and SHALL establish the folder contract its specification section
prescribes, so that later changes add files to an existing structure rather than inventing one.

`apps/api` SHALL establish `src/routes/`, `src/services/`, `src/middleware/` and `src/lib/` (§38),
import `express-async-errors` as its first import, and serve `GET /api/health`. `apps/web` SHALL
establish `src/features/`, `src/app/router.tsx` and `src/lib/api.ts`, with the strict MVVM
`model/` → `viewmodel/` → `view/` subfolder shape documented for feature folders (§39).
`packages/db` SHALL establish the `Pool` singleton, `src/ids.ts` with `ensureIdSequences()`, and a
`drizzle/` migration directory ready for `0000_init` (§40) — with no schema tables. `packages/shared`
SHALL establish its Zod entry point and the shared error-code module (§38). `packages/ui` SHALL
establish the shadcn/ui component root and the design-token stylesheet locked to preset `b1aJCZWLY`
(§39).

#### Scenario: API answers its health endpoint

- **WHEN** `apps/api` is started and `GET /api/health` is requested
- **THEN** it responds 200 without requiring a database connection, authentication or any pack
  content

#### Scenario: Web app renders a shell

- **WHEN** `apps/web` is started
- **THEN** it serves a routed application shell built from `packages/ui` components, with no
  console error and no network call to an unimplemented API route

#### Scenario: ID helpers are the only ID source

- **WHEN** `packages/db/src/ids.ts` is inspected
- **THEN** it exposes `ensureIdSequences()` and the formatter contract backed by raw sequences (§40),
  and no other bootstrap module constructs a formatted identifier by hand

#### Scenario: Migration directory is empty and ready

- **WHEN** `packages/db/drizzle/` is inspected
- **THEN** it exists, is tracked by git, and contains no migration carried over from v1 — the v2
  migration set starts fresh at `0000_init` per §40
