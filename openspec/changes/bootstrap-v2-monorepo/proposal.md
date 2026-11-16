# Bootstrap the Praxis v2 monorepo

**Phase:** §41 Phase A — "Repo bootstrap from v1 skeleton (stack, CI, hooks, docker, ansible)".
This is the first change in the repository; it has **no upstream change dependencies**.
Every other Phase A change (auth port, roster port, program hierarchy, packs, audit) depends on it.

**Implements:** §Layout, §42 (environments, configuration, deployment), §43 (testing conventions and
the no-domain-names guard), §2 (precedence and sources of truth), §Workflow (branch, commit prefixes,
hooks as CI). Touches §5 and §40 only to the extent of creating the `packs/` content root and the
`@platform/db` package shell — no schema, no pack content.

## Why

Praxis v2 is a new repository. Right now it holds a specification, an OpenSpec scaffold and nothing
executable: there is no package graph, no TypeScript project, no test runner, no container stack and
not even a git repository, so the git hooks that §Workflow designates as develop's CI cannot exist.
Nothing in phases A–I can be built, run or verified until that skeleton is in place.

V1 is a proven, four-month-old working monorepo on the same stack (§1: "built on the same stack,
conventions and proven engines"). Its toolchain — pnpm workspaces, Turbo, TypeScript project
references, per-package ESLint flat configs, Vitest with a coverage ratchet, husky + lint-staged, the
layered-env Docker Swarm stack — is the fastest correct way to stand v2 up, and it carries hard-won
operational fixes (the Windows `GIT_DIR` worktree hang, the fork-per-file OOM bound, the
`load-env.sh` quoting bug) that a from-scratch setup would rediscover the hard way.

The risk is the opposite one: V1 *is* the claims platform. Its schema, services, routes, web features
and scripts are saturated with claims vocabulary, which §Non-negotiables forbids in v2 core code
("No domain-specific names (claim, DCN, Pay/Deny) in core logic"). So this change copies V1's
**scaffolding** and deliberately leaves its **content** behind — and lands the §43 no-domain-names
guard test now, so that boundary is machine-enforced from the first commit rather than maintained by
good intentions.

## What Changes

### Repository and workspace

- Initialise the git repository on branch `develop` (§Workflow). Carry V1's `.gitignore`,
  `.gitattributes`, `.npmrc`, `.dockerignore`, `.prettierrc`, `.prettierignore`, `.shellcheckrc`. **[v1]**
- Root `package.json`: pnpm `11.5.0`, Node `>=20` engines, the §42 command set, Turbo + Prettier +
  husky + lint-staged + Vitest + TypeScript dev dependencies. Renamed from `praxis-dashboard` to
  `praxis` (v2's own name). **[v1, renamed]**
- `pnpm-workspace.yaml` over `apps/*` and `packages/*`, carrying V1's `allowBuilds` entries and the
  PGlite `packageExtensions` optional-peer narrowing. **[v1]**
- `turbo.json` task graph: `build`, `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`, `test`,
  `test:db`, the `db:*` tasks, `dev:setup`, `dev`. **[v1]**
- Root `tsconfig.json`: ES2022, `strict`, `moduleResolution: bundler`, the four `@platform/*` /
  `@workspace/ui` path aliases, and project references to all five packages. **[v1]**
- Five workspace packages, each a *shell* — `package.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, and the minimum source to typecheck, lint, build and test green:
  `apps/web` (React 19 + Vite 7 + Tailwind v4 + React Router v7 + Zustand + TanStack, strict MVVM
  folders per §39), `apps/api` (Express 4 + `express-async-errors`, `routes/` + `services/` +
  `middleware/` + `lib/` per §38), `packages/db` (Drizzle + `Pool` singleton + `ids.ts` +
  `drizzle.config.ts`), `packages/shared` (`@platform/shared`, Zod), `packages/ui`
  (`@workspace/ui`, shadcn/ui + design tokens). **[v1]**
- **[new]** `packs/` content root with the four launch pack directories from §Layout —
  `foundations/`, `compliance/`, `reasoning-generic/`, `claims/` — each carrying a README stating its
  §4.3 week range and that content arrives in its own change. Prettier covers `packs/**`; ESLint does
  not (authored JSON, not code).

### Quality gates

- Per-package ESLint flat configs, typescript-eslint, `tsconfigRootDir: import.meta.dirname`. **[v1]**
- Prettier at the root with `prettier-plugin-tailwindcss`. **[v1]**
- `lint-staged.config.mjs` with V1's group-by-owning-package `pnpm -C <pkg> exec eslint` strategy and
  its documented rationale. **[v1]**
- `.husky/pre-commit` (lint-staged → workspace typecheck → tests related to staged files) and
  `.husky/pre-push` (`lint`, `format:check`, `test`, `test:db`), with V1's `NODE_OPTIONS` heap guard,
  `--concurrent 1`, the `GIT_DIR`/`GIT_INDEX_FILE` unset that stops Turbo hanging on Windows in a
  linked worktree, and the delete-only-push short circuit. Plus `scripts/test-staged.mjs`. **[v1]**
- Vitest per package; `apps/api` additionally gets `vitest.db.config.ts` with the PGlite harness
  contract from §43 (no live DB in unit tests, `hasTestDb()`/`requireTestDb()` discovery by content),
  `pool: "forks"`, `isolate: true` and the `--max-old-space-size` ceiling. **[v1]**
- Root `vitest.workspace.ts` for single-command local full-suite runs. **[v1]**
- **[changed]** Coverage thresholds are a ratchet, as in §43 — but the *values* are re-locked to what
  v2's own bootstrap tests measure. V1's floors (api 69.7/88.9/92.3, web 60.2/73.3/86.6) are
  measurements of V1's code and are meaningless here. The ratchet doctrine comment — measure twice,
  keep headroom, never lower — is carried verbatim.
- **[new]** `apps/api/src/__tests__/no-domain-names.test.ts`: the §43 guard that asserts no core
  service folder contains pack vocabulary (`claim`, `dcn`, `pay`, `deny`) outside an explicit
  allow-list. It lands here, in the change that copies from the claims platform, because this is the
  change most able to leak that vocabulary.

### Container stack — local only

**Scope: this change delivers a stack that runs on a developer machine with plain `docker compose`.
No CI, no provisioning, no registry, no remote host, no Swarm.** §42's deployment path remains the
specification's target and is deferred, not abandoned.

- `docker/` compose base (Postgres 16, MinIO, Redis with the `allkeys-lru` ceiling and
  `requirepass`) plus the `local`, `seed` and `debug` overlays, and `load-env.sh` (keeping V1's
  export-per-line fix for values containing spaces). **[v1, narrowed]**
- **[corrected]** The overlay carried is V1's **`local`** overlay, not its `dev` overlay. V1's
  `dev.yml` is the shared environment CI deploys to remote hosts; `local.yml` is the developer-machine
  one, and it already carries the bridge-network override, host-published Redis, the `node_modules`
  shadowing fix and `CHOKIDAR_USEPOLLING`. Its one-shot `sync` service is **not** carried — that runs
  the claims flow-bundle sync, which becomes pack-sync (§44) later.
- **[changed]** The `bridge` driver moves into the base file and the overlay's network override
  disappears. V1 declares an `overlay` network in its base file — which needs an initialized Swarm —
  and overrides it back to `bridge` only in `local.yml`. With no Swarm consumer left, a base file that
  cannot be brought up on its own is a trap.
- **[v1, load-bearing]** `CHOKIDAR_USEPOLLING` on both app containers, with Vite reading it to enable
  `server.watch.usePolling`. WSL2 and DrvFs bind mounts do not propagate inotify into a Linux
  container, so without it the stack starts, reports healthy, and silently never reflects a host edit
  — on this repository's primary platform.
- `docker/env/` keeps the layered mechanism — `base.env` → `<env>.env` → optional gitignored `.env`,
  later wins — but carries only `base.env` and `local.env`. `APP_ENV` defaults to `local`. **[v1,
  narrowed]**
- **[changed]** V1's committed-secret trust model is **not** carried. V1 commits a SendGrid API key,
  a Better Auth secret and database/MinIO passwords to tracked files, and its env README says so:
  "Treat repo read access as production root access." In v2 nothing that authenticates beyond
  `localhost` is committed — and this change has no such value to commit. `local.env` carries only
  obviously-local placeholder container credentials, so the stack still starts with no manual secret
  assembly.
- `apps/api/Dockerfile` and `apps/web/Dockerfile` on `oven/bun:1.4-alpine`, built locally, with the
  `praxis-task` container-job wrapper (migrate and seed only) and `.vscode/tasks.json`. **[v1,
  narrowed]**
- **[changed, confirmed]** v2 is separable from a v1 stack on the same machine at every layer that
  can collide: compose project and network `praxis2`, images `praxis2-api` / `praxis2-web`,
  `praxis2`-prefixed volumes, a distinct database name, distinct buckets, Redis prefix `praxis2:`,
  and **published host ports in a distinct block** — Postgres 5433, MinIO 9010/9011, Redis 6380,
  api 3002, web 5174, Drizzle Studio 4984, all environment-driven. In-container ports are unchanged,
  leaving §Layout's 3001 and 5173 free for a host `pnpm dev` run. §42 marked the naming "(confirm)";
  confirmed.
- **[changed, confirmed]** `S3_PACKS_BUCKET` replaces V1's `S3_FLOWS_BUCKET` (§42).
  `S3_PUBLIC_BUCKET` is carried as-is (§10).
- **[changed]** `TZ`-style fixed `Asia/Kolkata` display assumptions are not carried into env defaults;
  display time zone is per market/cohort (§7), so nothing in the container stack pins one.

### Specification and agent guidance

- **[new]** `docs/SPEC.md` becomes the build specification at the path §2 names, holding the full
  v2 specification text currently living in `CLAUDE.md`.
- **[new]** `docs/v1-SPEC.md` carries V1's `docs/SPEC.md` verbatim as the §2 reference for `[v1]`
  behaviour.
- **[changed]** `CLAUDE.md` is replaced by the short Appendix B starter — "narrower than this file on
  purpose" (§2). The 58 KB duplicate is removed so the two cannot drift.
- **[new]** `openspec/config.yaml`'s context says "SPEC.md at the repo root"; §2 says `docs/SPEC.md`.
  §2 wins (it is the specification). The config wording is corrected to `docs/SPEC.md`.
- `README.md` and `TESTING.md` rewritten for v2 — V1's describe claims features. **[changed]**

### Deliberately NOT copied

Everything below is V1 content, not V1 scaffolding, and arrives in its own later change:

| Not copied | Why / where it belongs |
| --- | --- |
| `packages/db/src/schema.ts`, V1 `drizzle/` migrations | §40: "the v2 migration set starts fresh (`0000_init`)". Schema groups land per phase. |
| V1 `apps/api/src/services/*` (47 files: flow-bundle, rubric-scoring, assessment-*, proctoring, leaderboard, at-risk…) | Phases C–H. Copying them now would import the claims schema and fail the no-domain-names guard. |
| V1 `apps/api/src/routes/*` (claims, attempts, assessments, teaching…) | Phases C–D. §38's new router list supersedes it. |
| V1 `apps/web/src/features/*` (24 features incl. `admin-scenarios`, `training`, `trainee-assessment`) | Phases B–H. §39's new feature-folder list supersedes it. |
| V1 claims scripts: `scenarios:roundtrip`, `migrate:flow-bundles`, `backfill:claim-correctness`, `scaffold:variants`, `validate:variants`, `sync:search-member`, `report:flow-points` | Claims-specific; `packs:validate` / `packs:sync` replace the variant ones (§42, §44). |
| Feature-only web dependencies: `@vladmandic/face-api`, `pdfjs-dist`, `docx-preview`, `exceljs`, `jspdf*`, `xlsx`, `papaparse`, `@xyflow/react`, `@uiw/react-codemirror`, `@dnd-kit/*`, `zundo` | Added by the change that needs them (proctoring → §25, reports → §34, bundle studio → §10). A bootstrap that installs them carries dead weight. |
| `ci/jenkins/`, `ansible/` | Deployment automation. Not needed to run locally; deferred to the change that adds deployment. |
| `docker/remote-deploy.sh`, `sync-remote.sh`, `docker/preview/`, `host-nginx*.conf`, `nginx.conf`, the `prod`/`uat`/`dev`/`preview`/`customer`/`lt` env files and the `prod` and `dev` overlays | Remote-deployment surface. Nothing here is exercised by a local `docker compose up`; carrying it would ship untested scripts pointing at hosts that do not exist. |
| V1's `overlay` network driver and `deploy:` blocks | Swarm-only; an overlay network cannot be created without an initialized Swarm, so these would break `docker compose up` outright. |
| The `sync` service in V1's `local.yml` | Runs the claims flow-bundle sync. Becomes pack-sync (§44) in the packs change; the seed overlay covers what v2 has today. |
| Committed credentials in env files | V1's trust model, deliberately dropped (see above). |
| `loadtest/`, `postman/`, `.github/workflows/e2e.yaml` | Reference V1 claims endpoints; rewritten against §38's routers later. |
| `graphify-out/`, `.omc/`, `.agents/`, `secrets/`, `skills-lock.json`, `tools/` | V1-local tooling and artefacts, not part of the specified stack. |
| V1 coverage threshold *values* | Measurements of V1's code (see Quality gates above). |

`pnpm packs:validate` and `pnpm packs:sync` (§42) are **not** declared in this change: a script name
that resolves to nothing is worse than an absent one. They arrive with the packs capability, which
owns the validator.

## Capabilities

### New Capabilities

- `monorepo-workspace`: The repository's package graph and toolchain contract — workspace membership,
  the five package shells plus the `packs/` content root, TypeScript project references and path
  aliases, the Turbo task graph, and the §42 root command set. Defines what "the workspace builds"
  means.
- `quality-gates`: The verification contract — ESLint/Prettier/typecheck/Vitest wiring, the PGlite
  database-test harness, the coverage ratchet and its never-lower rule, the two git hooks as develop's
  CI, and the no-domain-names guard that keeps pack vocabulary out of core services.
- `container-stack`: The **local** runnable environment — the plain-compose base and its dev, seed and
  debug overlays, the layered committed env files and their precedence, locally built Bun-based
  images, the `praxis2` project/image/volume/port/bucket/Redis separation from a v1 stack on the same
  machine, and the bucket name set. Deployment is explicitly outside it.
- `spec-authority`: Where the build specification lives and which document wins — `docs/SPEC.md`,
  `docs/v1-SPEC.md`, the short `CLAUDE.md`, the OpenSpec config pointer, and the §2 precedence order
  the repository must make navigable.

### Modified Capabilities

None. `openspec/specs/` is empty; this is the repository's first change.

## Impact

**Created:** the entire repository skeleton — root configs (`package.json`,
`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `lint-staged.config.mjs`,
`vitest.workspace.ts`, dotfiles), `.husky/`, `scripts/test-staged.mjs`, `apps/web`, `apps/api`,
`packages/db`, `packages/shared`, `packages/ui`, `packs/`, `docker/`, `.vscode/`, `docs/SPEC.md`,
`docs/v1-SPEC.md`, `README.md`, `TESTING.md`.

**Modified:** `CLAUDE.md` (replaced with the Appendix B starter), `openspec/config.yaml` (SPEC path
corrected to `docs/SPEC.md`).

**New dependencies:** no runtime dependency that V1 does not already run in production. Versions are
pinned to V1's resolved set so v2 starts from a known-good lockfile rather than a fresh
`latest` resolution.

**Downstream:** every subsequent change. Specifically — the auth/session port (§7) needs `apps/api`
and Better Auth; the roster port (§9) and program hierarchy (§4) need `packages/db` and a migration
directory; the packs capability (§5) needs `packs/` and `S3_PACKS_BUCKET`; the audit port (§37) needs
the `apps/api` service layer. The no-domain-names guard constrains every later change that touches
`apps/api/src/services/`.

**Local only, by design.** The stack comes up under plain `docker compose`, the API answers
`/api/health` and the web app renders a shell. There is no schema, no auth, no content and no
trainee-facing behaviour — and no CI, provisioning, registry, remote host or Swarm. Nothing here can
be put in front of a user, and nothing here can be deployed. §42's deployment path stays in
`docs/SPEC.md` as the eventual target; this change implements only its local part.

**Governance (§45.3):** this change introduces **no** governance-owned value — no pass mark, weight,
threshold, cap, duration, renewal period or progression rule. The §45.1 config surfaces are created
by the changes that own them. Nothing in this change ships a default needing a "not approved" badge.

**Risks.**

1. *Silent claims leakage.* V1 files carry claims vocabulary in comments, type names and test
   fixtures. Mitigated by the no-domain-names guard test landing in this change, not a later one.
2. *Copying V1's coverage floors.* They would either fail instantly (nothing is covered) or, if the
   suite were trimmed to pass, hide the ratchet. Mitigated by re-locking to measured v2 values with
   the doctrine comment intact.
3. *Collision with a v1 stack on the same developer machine.* The sharper local risk is not a name
   clash — that fails loudly — but a **port** clash, which either refuses to start or silently
   attaches a tool to v1's database. Mitigated by separating project name, network, volumes, database
   name, buckets, Redis prefix **and published ports**, verified by a task that brings both local
   stacks up side by side.
4. *Lockfile drift.* Resolving every dependency afresh could pick a version V1 has never run.
   Mitigated by pinning to V1's resolved versions and treating upgrades as their own change.
