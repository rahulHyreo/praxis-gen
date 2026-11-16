## ADDED Requirements

### Requirement: Lint and format configuration

The repository SHALL lint with ESLint flat configs owned **per package**, not at the root, and
format with Prettier owned **at the root**. Each package SHALL carry `eslint.config.js` using
`typescript-eslint` with `tsconfigRootDir: import.meta.dirname`, so parser and plugin resolution
follow the config file rather than the invoking directory. [v1]

Prettier SHALL be configured once at the root, including `prettier-plugin-tailwindcss`, with
`.prettierignore` excluding build output, coverage, lockfiles and vendored assets.

#### Scenario: Linting runs per package

- **WHEN** `pnpm lint` runs at the repository root
- **THEN** Turbo invokes each package's own ESLint with that package's config, and a rule violation
  in any package fails the command

#### Scenario: A lint violation fails the command

- **WHEN** an unused variable is introduced into any package's `src/`
- **THEN** `pnpm lint` exits non-zero and names the file and rule

### Requirement: Staged-file gate groups work by owning package

`lint-staged.config.mjs` SHALL format every staged file with Prettier from the repository root, and
SHALL lint staged code files by grouping them by owning package and invoking
`pnpm -C <pkg> exec eslint` once per package with paths relative to that package. [v1]

This grouping is load-bearing, not stylistic: ESLint flat config resolves only from the current
working directory while the configs live per package, and under pnpm the `eslint` binary is a
per-package dev dependency that is not hoisted to the root `node_modules/.bin`. A bare root `eslint`
invocation therefore cannot work. The config SHALL retain the comment recording this.

Staged files that belong to no package SHALL receive Prettier only, there being no root ESLint config
to lint them against.

#### Scenario: Staged files in two packages lint with their own configs

- **WHEN** a commit stages one file in `apps/api` and one in `apps/web`
- **THEN** ESLint is invoked once per package with that package's config, and both files are
  formatted by Prettier

#### Scenario: A root-level staged file is formatted but not linted

- **WHEN** a commit stages a root-level script outside any package
- **THEN** Prettier formats it and no ESLint invocation is attempted against it

#### Scenario: Pack content is formatted, not linted

- **WHEN** a commit stages a JSON file under `packs/`
- **THEN** Prettier formats it and no ESLint invocation is attempted against it

### Requirement: Git hooks are the branch's CI

`.husky/pre-commit` and `.husky/pre-push` SHALL be the verification gate for `develop` and for pull
requests into it, per §Workflow: "The git hooks are develop's CI". [v1]

`pre-commit` SHALL run, in order: lint-staged; the workspace typecheck; and the tests related to the
staged files via `scripts/test-staged.mjs`. `pre-push` SHALL run, in order: `pnpm lint`,
`pnpm format:check`, `pnpm test` (with the coverage gate), `pnpm test:db`. Any non-zero exit SHALL
abort the operation.

Three operational guards from v1 SHALL be carried, each with its explanatory comment intact, because
each was written in response to a real failure:

- `NODE_OPTIONS=--max-old-space-size=8192` and `lint-staged --concurrent 1`, so a large commit fails
  with a lint error rather than an out-of-memory kill.
- `unset GIT_DIR GIT_INDEX_FILE` before any Turbo invocation, because git exports `GIT_DIR` to hooks
  and in a linked worktree Turbo's git hashing then fails and hangs indefinitely on Windows.
  `GIT_INDEX_FILE` SHALL remain set for `scripts/test-staged.mjs`, which reads the index itself.
- A delete-only push, identified by an all-zero local SHA on every pushed ref, SHALL skip
  verification entirely.

#### Scenario: A failing test blocks the commit

- **WHEN** a developer stages a change that breaks a test covering a staged file and runs
  `git commit`
- **THEN** the hook exits non-zero, the commit is not created, and the failing test is named

#### Scenario: A type error blocks the commit

- **WHEN** a developer stages a change that fails `pnpm typecheck` and runs `git commit`
- **THEN** the hook exits non-zero before reaching the test step

#### Scenario: A branch deletion skips verification

- **WHEN** a developer runs `git push origin --delete <branch>`
- **THEN** the pre-push hook exits zero immediately, running no lint, format, typecheck or test step

#### Scenario: Turbo does not hang in a linked worktree

- **WHEN** a hook runs inside a linked git worktree, with `GIT_DIR` exported by git
- **THEN** `GIT_DIR` and `GIT_INDEX_FILE` are unset before Turbo is invoked and the hook completes

### Requirement: Test harness and database-test isolation

Every package SHALL carry a Vitest configuration. Unit tests SHALL NOT require a live database or a
network: `packages/db` is mocked with `vi.mock("@platform/db")` in API unit tests, and `apps/web`
tests mock `lib/api.ts`. Fake timers SHALL be deterministic and always restored. [v1, §43]

`apps/api` SHALL additionally carry `vitest.db.config.ts` running the database-backed suites against
an in-memory PGlite built from `packages/db/drizzle`, requiring no Docker, no Postgres install and no
`TEST_DATABASE_URL`. That config SHALL discover its suites **by file content** — those referencing
`hasTestDb()` or `requireTestDb()` and not replacing the db client for the whole file — so adding a
database-backed suite needs no list kept in step. It SHALL pin its auth and Redis environment
variables so a developer's local `.env` cannot change what those suites see, and SHALL disable
coverage, the coverage gate belonging to `pnpm test`.

Test execution SHALL use `pool: "forks"` with `isolate: true` and an explicit
`--max-old-space-size` ceiling per fork. This is load-bearing: a worker thread rejects that flag and
its heap counts against the parent's resident set, so neither the ceiling nor a legible
out-of-memory failure is possible there. Fork count SHALL drop to one when a real
`TEST_DATABASE_URL` is attached, because the database setup truncates tables between tests and two
suites must never overlap.

#### Scenario: Unit tests run without a database

- **WHEN** `pnpm test` runs with no `TEST_DATABASE_URL` and no database reachable
- **THEN** every package's suite passes, and database-gated suites skip rather than fail

#### Scenario: Database suites run on PGlite with no setup

- **WHEN** `pnpm test:db` runs on a machine with no Docker and no Postgres installed
- **THEN** the database-backed API suites execute against in-memory PGlite and pass

#### Scenario: A new database suite is picked up automatically

- **WHEN** a new test file calling `requireTestDb()` is added under `apps/api/src/`
- **THEN** `pnpm test:db` includes it with no edit to `vitest.db.config.ts`

#### Scenario: Local environment cannot leak into database suites

- **WHEN** a developer's local `.env` sets a different auth secret or Redis URL and `pnpm test:db`
  runs
- **THEN** the suites see the values pinned in `vitest.db.config.ts`, not the local ones

#### Scenario: A runaway suite fails legibly

- **WHEN** a test file exceeds the configured per-fork heap ceiling
- **THEN** the run fails with a JavaScript heap-out-of-memory error naming the file, rather than
  being killed by the operating system with no attribution

### Requirement: Coverage is a one-way ratchet

Each package's Vitest configuration SHALL declare coverage thresholds for lines, statements, branches
and functions, and `pnpm test` SHALL fail when a reading falls below its threshold. Thresholds SHALL
be raised as coverage rises and SHALL NEVER be lowered. [v1, §43]

Thresholds SHALL be locked to **v2's own measured coverage** at bootstrap. V1's threshold values are
measurements of v1's code and SHALL NOT be copied. [changed]

Each threshold SHALL sit below, not on, its measured reading, because a reading is not stable between
identical runs and a floor set on the edge flakes rather than guards. Every raise SHALL be recorded
in a comment stating what was measured, under which command, and why that floor was chosen — the
practice v1 established and which makes the ratchet auditable.

#### Scenario: Deleting a test fails the gate

- **WHEN** a test covering bootstrap code is deleted and `pnpm test` runs
- **THEN** the coverage gate fails rather than silently accepting the lower reading

#### Scenario: Raising a floor is justified in place

- **WHEN** a change raises a coverage threshold
- **THEN** the configuration carries a comment naming the measured reading, the command it was
  measured under, and the margin left below it

#### Scenario: V1 threshold values are not present

- **WHEN** the bootstrap coverage thresholds are inspected
- **THEN** they are v2's own measured values, not v1's (api 69.7 / 88.9 / 92.3, web 60.2 / 73.3 /
  86.6), and the suite passes on a clean checkout

### Requirement: Pack vocabulary is barred from core services

A guard test SHALL assert that core service folders contain no pack vocabulary — `claim`, `dcn`,
`pay`, `deny` — outside an explicit allow-list of pack-scoped adapters. The test SHALL fail with the
offending file, line and term named. [new, §43]

This guard lands in this change rather than a later one because this change copies from the claims
platform and is therefore the change most able to leak that vocabulary. §Non-negotiables states the
rule the guard enforces: "No domain-specific names (claim, DCN, Pay/Deny) in core logic".

The allow-list SHALL be a declared, reviewable list rather than a pattern broad enough to absorb new
violations. Adding an entry is a deliberate act visible in review.

#### Scenario: A leaked term fails the guard

- **WHEN** a service file under `apps/api/src/services/` is added that names a claim, a DCN, or a
  pay or deny decision in an identifier or comment
- **THEN** the guard test fails and names the file, the line and the term

#### Scenario: An allow-listed adapter passes

- **WHEN** a file on the declared allow-list uses pack vocabulary
- **THEN** the guard test passes, and the allow-list entry is visible in the test source

#### Scenario: The guard passes on the bootstrap tree

- **WHEN** the guard runs against the tree this change produces
- **THEN** it passes, confirming that no v1 service, route or fixture was carried over

### Requirement: Deferred guard tests are recorded, not forgotten

Every §43 guard test this change cannot yet implement SHALL be recorded in `TESTING.md`, naming the
guard, the §43 clause it comes from and the capability that will own it, so that a deferral is a
tracked commitment rather than an omission.

The guards so deferred are the answer-key leak sweep over trainee-role serialisers, the
`COMPLETION_TRIGGERS` parity test, snapshot immutability, the AI auto-accept test, the HITRUST
wording assertion and the pack allow-list sweep. Each depends on code this change does not create, so
each MUST be deferred to the change that creates that code rather than written against nothing.

No trainee-facing payload, submission path or AI suggestion exists in the bootstrap tree, so there is
nothing yet for the answer-key-stripping or no-auto-accept guards to assert against.

#### Scenario: Deferred guards are listed

- **WHEN** `TESTING.md` is read
- **THEN** it names each deferred §43 guard test, its clause and its owning future capability

#### Scenario: No trainee payload exists to leak

- **WHEN** the bootstrap tree is searched for a trainee-role serialiser or submission handler
- **THEN** none exists, and `TESTING.md` records that the answer-key and no-auto-accept guards are
  deferred for that reason rather than overlooked
