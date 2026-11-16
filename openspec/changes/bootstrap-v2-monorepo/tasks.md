Implementation tasks for `bootstrap-v2-monorepo` (§41 Phase A, first change).

Source V1 repository: `../praxis` — **read-only**. Files are copied out of it; nothing is written
back. Where a task says "carry", it means copy the V1 file and edit only what v2 changes, keeping its
explanatory comments intact (design D1).

Verification convention: a task is done when the command named in it exits zero on a clean checkout.
Order follows design's Migration Plan — git and hooks land before the first substantive commit, so
that no commit bypasses the gate it establishes.

## 1. Repository initialisation

- [ ] 1.1 `git init` on branch `develop`; set `core.autocrlf` per `.gitattributes`; make the first
      empty commit so hooks have a parent to compare against.
      *Depends on:* nothing.
- [ ] 1.2 Carry V1's `.gitignore`, `.gitattributes`, `.npmrc`, `.dockerignore`, `.prettierrc`,
      `.prettierignore`, `.shellcheckrc`. Drop V1-local entries (`graphify-out/`, `.omc/`,
      `.agents/`, `secrets/`, `skills-lock.json`, `tools/`); add `docker/env/.env`.
      *Depends on:* 1.1.
- [ ] 1.3 Verify `docker/env/.env` and every build/coverage output path are ignored —
      `git status --ignored` lists them, `git check-ignore` confirms each.
      *Depends on:* 1.2. Satisfies `container-stack` → "No secret is committed".

## 2. Root toolchain

- [ ] 2.1 Root `package.json`: name `praxis`, `private`, `packageManager: pnpm@11.5.0`,
      `engines.node >=20`, the §42 command set from `monorepo-workspace` → "Root command set", and
      V1's root devDependencies (Turbo, Prettier + tailwind plugin, husky, lint-staged, TypeScript
      5.9.3, Vitest, `@vitest/coverage-v8`). Do **not** declare `packs:validate` / `packs:sync`.
      *Depends on:* 1.2.
- [ ] 2.2 Carry `pnpm-workspace.yaml` — `apps/*` + `packages/*`, V1's `allowBuilds` entries, and the
      PGlite `packageExtensions` optional-peer narrowing with its comment.
      *Depends on:* 2.1.
- [ ] 2.3 Carry `turbo.json`: the 18 tasks from `monorepo-workspace` → "Turbo task graph", with
      `build`/`test` output and dependency declarations and `cache: false` on every `db:*` task and
      `dev:setup`.
      *Depends on:* 2.2.
- [ ] 2.4 Root `tsconfig.json`: ES2022 / ESNext / bundler / `strict`, the six path aliases, `files: []`
      and project references to all five packages.
      *Depends on:* 2.2.
- [ ] 2.5 Root `vitest.workspace.ts` referencing all five package configs.
      *Depends on:* 2.4.

## 3. packages/shared

- [ ] 3.1 `packages/shared` package shell: `package.json` (`@platform/shared`, Zod), `tsconfig.json`,
      `eslint.config.js`, `vitest.config.ts`. Lowest package in the graph, so it lands first.
      *Depends on:* 2.4.
- [ ] 3.2 `src/index.ts` entry point plus the shared error-code module (§38), seeded with the §38
      codes this change can justify and nothing speculative.
      *Depends on:* 3.1.
- [ ] 3.3 Tests: error codes are unique, exported, and stable string literals.
      *Depends on:* 3.2. Satisfies `monorepo-workspace` → "Package shells are runnable, not empty".

## 4. packages/db

- [ ] 4.1 `packages/db` package shell: `package.json` (`@platform/db`, Drizzle, `pg`, `dotenv`, the
      `./env` `./schema` `./client` `./ids` subpath exports), `tsconfig.json`, `eslint.config.js`,
      `vitest.config.ts`, `drizzle.config.ts`.
      *Depends on:* 2.4.
- [ ] 4.2 `src/env.ts` and `src/client.ts` — the `Pool` singleton, with V1's "a real environment
      variable always beats `.env`" precedence.
      *Depends on:* 4.1.
- [ ] 4.3 `src/ids.ts`: `ensureIdSequences()` and the sequence-backed formatter contract (§40). No
      pack-specific formatter — `formatSubjectRef` is pack-defined and belongs to the packs change.
      *Depends on:* 4.2.
- [ ] 4.4 **Migration scaffolding:** empty, git-tracked `drizzle/` directory ready for `0000_init`
      (§40), with a README stating that v2's migration set starts fresh and that no V1 migration is
      carried.
      *Depends on:* 4.1. Satisfies `monorepo-workspace` → "Migration directory is empty and ready".
- [ ] 4.5 **Seed scaffolding:** `src/seed.ts` entry point that runs, reports that there is nothing to
      seed yet, and exits zero — so `pnpm db:seed` and the compose seed overlay are wired end to end
      before any table exists. No seed rows: §40's schema groups land with the changes that own them.
      *Depends on:* 4.2.
- [ ] 4.6 `src/schema.ts` as an empty, exported module with a comment naming §40's table groups and
      the phase that adds each. **No tables.**
      *Depends on:* 4.1.
- [ ] 4.7 Tests: `ensureIdSequences()` is idempotent; the env precedence rule holds; `src/seed.ts`
      exits zero against an empty database.
      *Depends on:* 4.3, 4.5.

## 5. packages/ui

- [ ] 5.1 `packages/ui` package shell: `package.json` (`@workspace/ui`, shadcn/ui, radix-ui,
      Tailwind v4, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `next-themes`),
      `tsconfig.json`, `tsconfig.lint.json`, `eslint.config.js`, `vitest.config.ts`,
      `components.json`, and the `./globals.css` `./lib/*` `./components/*` `./hooks/*` exports.
      *Depends on:* 2.4.
- [ ] 5.2 Carry the design-token stylesheet locked to shadcn preset `b1aJCZWLY` (§39) and the `cn`
      utility.
      *Depends on:* 5.1.
- [ ] 5.3 Carry V1's shadcn component set (design Open Question 2 — generated primitives, no domain
      content). Record in the package README that these are generated and how to add more.
      *Depends on:* 5.2.
- [ ] 5.4 Tests: the token stylesheet exposes the preset's variables in both themes; a representative
      component renders; `cn` merges conflicting Tailwind classes correctly.
      *Depends on:* 5.3.

## 6. apps/api shell

- [ ] 6.1 `apps/api` package shell: `package.json` (`@platform/api`, Express 4,
      `express-async-errors`, `cors`, Zod, `@platform/db`, `@platform/shared`, `drizzle-orm`; dev:
      `tsx`, PGlite, `supertest`, ESLint, Vitest). Omit `better-auth`, `@sendgrid/mail` and
      `@aws-sdk/*` — no importer yet (design D2).
      *Depends on:* 3.2, 4.2.
- [ ] 6.2 `tsconfig.json`, `eslint.config.js`, `turbo.json`.
      *Depends on:* 6.1.
- [ ] 6.3 `src/index.ts` and `src/server.ts` with `express-async-errors` as the **first** import and a
      load-bearing comment saying why (§38; design Risks). Establish `src/routes/`,
      `src/services/`, `src/middleware/`, `src/lib/`, each with a README naming the § section and
      phase that fills it.
      *Depends on:* 6.2.
- [ ] 6.4 `GET /api/health` answering 200 with no database, auth or pack dependency; the
      `{ error, details?, code? }` error shape and the ZodError → 422 mapping as middleware (§38).
      *Depends on:* 6.3.
- [ ] 6.5 Tests (supertest): `/api/health` returns 200 with no database reachable; an unhandled async
      rejection in a route produces the §38 error shape, not a hung request; a ZodError maps to 422.
      *Depends on:* 6.4. Satisfies `monorepo-workspace` → "API answers its health endpoint".

## 7. apps/web shell

- [ ] 7.1 `apps/web` package shell: `package.json` (React 19, React Router v7, Zustand, TanStack
      Form/Table/Query, Zod, Sonner, `date-fns`, `@workspace/ui`, `@platform/shared`; dev: Vite 7,
      Tailwind v4 Vite plugin, Testing Library, jsdom, ESLint, Vitest). Omit every feature-only
      dependency listed in the proposal's "Deliberately NOT copied" table.
      *Depends on:* 3.2, 5.2.
- [ ] 7.2 `vite.config.ts`, `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`,
      `eslint.config.js`, `turbo.json`, `index.html`, `components.json`.
      *Depends on:* 7.1.
- [ ] 7.3 `src/main.tsx`, `src/App.tsx`, `src/app/router.tsx` as the single route registry (§39), and
      `src/lib/api.ts` as the single API access point with a comment recording that views never call
      `api.*` directly.
      *Depends on:* 7.2.
- [ ] 7.4 `src/features/` with a README documenting the strict MVVM `model/` → `viewmodel/` → `view/`
      contract and the §39 v2 feature-folder list, plus one reference feature folder following the
      shape end to end.
      *Depends on:* 7.3.
- [ ] 7.5 Application shell rendered from `@workspace/ui` — theme provider, Sonner toaster, the
      mandatory loading and error states (§39).
      *Depends on:* 7.4.
- [ ] 7.6 Tests: the shell renders with no console error; the router registers its routes; the
      reference feature's viewmodel is tested with `lib/api.ts` mocked (§43 — no network in web
      tests).
      *Depends on:* 7.5. Satisfies `monorepo-workspace` → "Web app renders a shell".

## 8. packs/ content root

- [ ] 8.1 Create `packs/` with `foundations/`, `compliance/`, `reasoning-generic/` and `claims/`,
      each carrying a README naming its §4.3 week range and the change that will author its content.
      No `package.json` — pack content is data, not a workspace member.
      *Depends on:* 2.2.
- [ ] 8.2 Verify Prettier covers `packs/**` and ESLint does not; `pnpm install` does not treat
      `packs/` as a workspace package.
      *Depends on:* 8.1, 2.1. Satisfies `monorepo-workspace` → "packs/ is content, not a package" and
      `quality-gates` → "Pack content is formatted, not linted".

## 9. Quality gates — lint, format, staged files

- [ ] 9.1 Verify `pnpm lint`, `pnpm format:check` and `pnpm typecheck` all exit zero across the five
      packages, and that `pnpm format:check` also catches a misformatted root config, a `packs/` file
      and a `docs/` file.
      *Depends on:* 6.5, 7.6, 8.2, 3.3, 4.7, 5.4. Satisfies `monorepo-workspace` → "Formatting covers
      non-package files".
- [ ] 9.2 Carry `lint-staged.config.mjs` with V1's group-by-owning-package strategy and its full
      rationale comment. `PKG_ROOTS` = the five packages.
      *Depends on:* 9.1.
- [ ] 9.3 Tests for the lint-staged config: a staged file in two different packages produces one
      ESLint invocation per package with package-relative paths; a root-level file produces Prettier
      only; a `packs/` JSON file produces Prettier only.
      *Depends on:* 9.2. Satisfies all three `quality-gates` → "Staged-file gate" scenarios.

## 10. Test harness and coverage ratchet

- [ ] 10.1 Carry V1's `apps/api/vitest.config.ts` fork/heap/parallelism configuration with its
      comments — `pool: "forks"`, `isolate: true`, the `--max-old-space-size` ceiling, and the
      drop-to-one-fork rule when `TEST_DATABASE_URL` is set. Strip V1's threshold values (task 10.5
      sets v2's).
      *Depends on:* 6.5.
- [ ] 10.2 Carry `apps/api/vitest.db.config.ts` and the `src/__tests__/pglite/` harness — PGlite
      built from `packages/db/drizzle` once per run, a copy per test file, content-based suite
      discovery on `hasTestDb()` / `requireTestDb()`, and the pinned auth/Redis env. Coverage
      disabled.
      *Depends on:* 10.1, 4.4.
- [ ] 10.3 Add a database-gated smoke suite calling `requireTestDb()`, so `pnpm test:db` has real work
      and the harness is proven rather than merely configured. Assert it skips under `pnpm test` and
      runs under `pnpm test:db`.
      *Depends on:* 10.2. Satisfies `quality-gates` → "Database suites run on PGlite with no setup",
      "A new database suite is picked up automatically", "Unit tests run without a database".
- [ ] 10.4 Test that a developer's local `.env` cannot change what the database suites see.
      *Depends on:* 10.3. Satisfies `quality-gates` → "Local environment cannot leak into database
      suites".
- [ ] 10.5 **Lock the coverage ratchet.** Measure every package twice with the command CI runs
      (`pnpm test`), set each floor below the lower reading, and write the comment recording the
      readings, the command and the chosen margin (design D5). Assert V1's values are absent.
      *Depends on:* 10.3, 3.3, 4.7, 5.4, 7.6. Satisfies all three `quality-gates` → "Coverage is a
      one-way ratchet" scenarios.

## 11. The no-domain-names guard

- [ ] 11.1 Write `apps/api/src/__tests__/no-domain-names.test.ts` (§43): sweep core service folders
      for `claim`, `dcn`, `pay`, `deny`; fail naming file, line and term; allow-list as a declared
      array in the test source, not a glob (design D4).
      *Depends on:* 6.3.
- [ ] 11.2 Tests for the guard itself: a planted violation fails and is named; an allow-listed path
      passes; the guard passes on the real bootstrap tree.
      *Depends on:* 11.1. Satisfies all three `quality-gates` → "Pack vocabulary is barred from core
      services" scenarios.
- [ ] 11.3 Write the §43 deferral register in `TESTING.md`: each deferred guard (answer-key leak,
      `COMPLETION_TRIGGERS` parity, snapshot immutability, AI auto-accept, HITRUST wording, pack
      allow-list sweep), its §43 clause and its owning future capability — including the note that no
      trainee-facing payload or submission path exists yet for the answer-key and no-auto-accept
      guards to assert against.
      *Depends on:* 11.2. Satisfies both `quality-gates` → "Deferred guard tests are recorded, not
      forgotten" scenarios.

## 12. Git hooks

- [ ] 12.1 `husky` init; carry `.husky/pre-commit` — lint-staged (`--concurrent 1`, 8 GB
      `NODE_OPTIONS`) → workspace typecheck with `GIT_DIR`/`GIT_INDEX_FILE` unset → staged-file
      tests, with all three rationale comments intact.
      *Depends on:* 9.3, 10.5, 11.2.
- [ ] 12.2 Carry `scripts/test-staged.mjs`, which reads the index itself (so `GIT_INDEX_FILE` stays
      set for it) and includes the api database suites.
      *Depends on:* 12.1.
- [ ] 12.3 Carry `.husky/pre-push` — `lint`, `format:check --cache`, `test`, `test:db`, with the
      delete-only-push short circuit and the heap and `GIT_DIR` guards.
      *Depends on:* 12.2.
- [ ] 12.4 **Prove the hooks block.** On Windows: a failing test blocks the commit; a type error
      blocks the commit before the test step; a branch deletion skips verification entirely; a hook
      run inside a linked worktree completes instead of hanging.
      *Depends on:* 12.3. Satisfies all four `quality-gates` → "Git hooks are the branch's CI"
      scenarios.

## 13. Local container stack

Scope: a stack that runs on a developer machine under plain `docker compose`. No CI, provisioning,
registry, remote host or Swarm (design D9). §42 is **not** edited — deployment is deferred, not
abandoned (design D10).

- [ ] 13.1 Carry `docker/docker-compose.yml` — Postgres 16, MinIO, Redis with the `allkeys-lru`
      ceiling, `requirepass` and the empty-password healthcheck branch — converting V1's `overlay`
      network to `bridge` and **dropping every `deploy:` block**. Project and network name `praxis2`,
      `praxis2`-prefixed named volumes.
      *Depends on:* 1.2.
- [ ] 13.2 Carry V1's **`local`** overlay as `docker-compose.local.yml`, plus `seed` and `debug`. Do
      **not** carry `dev` or `prod`, `nginx.conf`, `host-nginx*.conf`, `docker/preview/`,
      `remote-deploy.sh` or `sync-remote.sh`. Drop the overlay's now-redundant network override (the
      base file is already `bridge`) and drop its `sync` service — that runs the claims flow-bundle
      sync (design D9). Tag locally built images `praxis2-api` / `praxis2-web` and prefix its volumes
      `praxis2`.
      *Depends on:* 13.1. Satisfies `container-stack` → "No claims-specific service is carried".
- [ ] 13.3 Verify no Swarm-only construct survives: no `overlay` driver, no `deploy:` key, and
      `docker compose config` validates with **no Swarm initialized**.
      *Depends on:* 13.2. Satisfies `container-stack` → "No Swarm-only construct remains".
- [ ] 13.4 Verify no remote-deployment surface survives: `docker/` contains no remote-deploy,
      sync-remote, host-nginx, preview or registry script, and no overlay for a deployed environment.
      *Depends on:* 13.2. Satisfies `container-stack` → "No remote deployment path is carried".
- [ ] 13.5 Carry the local overlay's `CHOKIDAR_USEPOLLING` + interval on both app containers, and the
      `node_modules` shadowing fix (named volume for the workspace root, anonymous volume per
      package) with V1's naming rationale intact. Wire `apps/web/vite.config.ts` to read the variable
      and set `server.watch.usePolling`.
      *Depends on:* 13.2, 7.2.
- [ ] 13.6 Carry `docker/env/base.env` and create `local.env`; `APP_ENV` defaults to `local`. Do
      **not** create `dev.env`, `uat.env`, `prod.env`, `preview.env`, `customer.env` or `lt.env` —
      keep the layering mechanism, drop the deployed-environment instances. Replace
      `S3_FLOWS_BUCKET` with `S3_PACKS_BUCKET`; keep `S3_PUBLIC_BUCKET`; set the Redis key prefix to
      `praxis2:`; give the database a v2-distinct name. Remove every fixed display time zone (§7).
      *Depends on:* 13.2. Satisfies `container-stack` → "Only local env files exist".
- [ ] 13.7 **Apply the secrets model (design D11).** Carry no credential that authenticates beyond
      `localhost`: no API key, cloud account key or auth signing secret — v2 has none yet. Put
      obviously-local placeholder container credentials in `local.env`. Rewrite
      `docker/env/README.md` to describe the three layers, mark the placeholders as localhost-only,
      and **drop V1's "repo read access is production root access" warning**, which no v2 committed
      file earns.
      *Depends on:* 13.6. Satisfies all four `container-stack` → "V1's committed-secret trust model is
      not carried" scenarios.
- [ ] 13.8 Set the published host-port defaults to v2's block — Postgres 5433, MinIO 9010 / console
      9011, Redis 6380, api 3002, web 5174, Drizzle Studio 4984 — each still `${VAR:-default}` so it
      is overridable without editing a compose file. Leave in-container ports unchanged so §Layout's
      3001 / 5173 stay free for a host `pnpm dev` (design D6).
      *Depends on:* 13.6.
- [ ] 13.9 Carry `docker/load-env.sh` with its read-loop and the comment explaining why `source`
      cannot be used.
      *Depends on:* 13.6.
- [ ] 13.10 `apps/api/Dockerfile` and `apps/web/Dockerfile` on `oven/bun:1.4-alpine`, built locally
      with no registry step; the `praxis-task` container-job wrapper scoped to migrate and seed only;
      `.vscode/tasks.json` exposing the local stack and job tasks.
      *Depends on:* 13.9, 6.4, 7.5. Satisfies `container-stack` → "Images build locally", "Container
      jobs go through the wrapper".
- [ ] 13.11 Tests for env loading: `local.env` overrides `base.env`; a missing `.env` layer is not an
      error; a value containing spaces survives `load-env.sh` intact; a layered load exports every
      key; `S3_FLOWS_BUCKET` appears nowhere; no display time zone is set globally.
      *Depends on:* 13.9. Satisfies the `container-stack` → "Layered committed environment files" and
      "Environment loading survives values containing spaces" scenarios, plus "Bucket names reflect
      packs, not flows" and "No fixed display time zone".
- [ ] 13.12 Bring the base stack up on a machine with **no Swarm initialized**; confirm Postgres,
      MinIO and Redis each report healthy through their own healthcheck; confirm Redis is reachable
      with `redis-cli` on its published port; confirm the seed overlay creates `S3_PACKS_BUCKET` and
      `S3_PUBLIC_BUCKET`.
      *Depends on:* 13.10, 4.5. Satisfies `container-stack` → "Base stack comes up with plain
      compose", "Pack bucket is created by the seed overlay".
- [ ] 13.13 Bring the stack up with the local overlay; confirm `GET /api/health` answers 200 through
      it, and that a host source edit hot-reloads both api and web **on Windows** — the platform the
      polling fix exists for.
      *Depends on:* 13.12, 13.5. Satisfies `container-stack` → "Local overlay runs the apps from the
      working tree", "Health check answers on the local stack", and both "Hot reload works through a
      Windows bind mount" scenarios.
- [ ] 13.14 **Prove local separation.** Bring the v1 and v2 local stacks up on one machine; assert no
      conflict on compose project name, container name, network, volume, published port or Redis
      keyspace; assert every v2 database URL, bucket name and Redis key resolves to a v2 resource;
      assert `pnpm dev` on the host still binds 3001 and 5173; assert overriding `POSTGRES_PORT` in
      `docker/env/.env` moves the published port with no compose edit.
      *Depends on:* 13.13. Satisfies all five `container-stack` → "The v2 local stack cannot collide
      with v1's" scenarios.

## 14. Specification and documentation

- [ ] 14.1 Create `docs/SPEC.md` holding the full v2 specification **moved** from `CLAUDE.md`, every
      § anchor unchanged — §42's deployment path included and unedited (design D10). Verify no
      section was renumbered, merged or split.
      *Depends on:* 1.2. Satisfies `container-stack` → "The specification keeps its deployment
      section".
- [ ] 14.2 Create `docs/v1-SPEC.md` from V1's `docs/SPEC.md`, with a header bounding its authority to
      items `docs/SPEC.md` marks `[v1]` and stating that `docs/SPEC.md` wins on anything `[changed]`.
      *Depends on:* 14.1.
- [ ] 14.3 Replace `CLAUDE.md` with the Appendix B starter, in the same commit as 14.1 so the
      repository is never in a two-copy state.
      *Depends on:* 14.1. Satisfies `spec-authority` → "The specification is not duplicated", "The
      duplicate is gone".
- [ ] 14.4 Correct `openspec/config.yaml`'s context from "SPEC.md at the repo root" to
      `docs/SPEC.md` (§2 wins — design D7). Flag it in the PR as a documentation correction.
      *Depends on:* 14.1.
- [ ] 14.5 Write `README.md` for v2: workspace layout, the §42 command set, how to bring the **local**
      stack up (including the v2 port block and how to override it), `develop` plus the §Workflow
      commit prefixes including `pack`, the §2 precedence order, and a plain statement of what does
      not exist yet — no schema, auth, content or trainee behaviour, and no deployment path of any
      kind. State explicitly that CI, provisioning, registry and Swarm deployment are deferred to a
      later change and that §42 still describes the eventual target, so a narrowed scope is not read
      as a changed plan.
      *Depends on:* 14.3, 13.13. Satisfies `container-stack` → "The local-only boundary is
      documented".
- [ ] 14.6 Write `TESTING.md` for v2: §43 conventions, the PGlite path, the ratchet rule, and the
      task 11.3 deferral register. Do not carry V1's claims-feature testing notes.
      *Depends on:* 14.5, 11.3.
- [ ] 14.7 Tests / checks for the documentation contract: `docs/SPEC.md` and `docs/v1-SPEC.md` exist;
      `CLAUDE.md` no longer carries the numbered sections; every document path named in any statement
      of the precedence order resolves; the orders stated in `CLAUDE.md`, `openspec/config.yaml` and
      `README.md` agree.
      *Depends on:* 14.6. Satisfies all `spec-authority` scenarios not covered by 14.3.

## 15. Audit log — explicitly none in this change

- [ ] 15.1 Record in the PR description that this change emits **no** `audit_log` row and creates no
      §45.1 config surface or §45.3 governance value, with the reason: it changes no content, score,
      configuration, roster entry, standard or credential, and the `audit_log` table itself is
      created by the §37 audit port change later in Phase A. Verify by inspection that no bootstrap
      code path writes an audit row or reads a governance-owned value.
      *Depends on:* 14.7. Required by the artifact rules so the omission is a recorded decision rather
      than an oversight.

## 16. Acceptance

- [ ] 16.1 Clean-checkout run on Windows: `pnpm install`, `build`, `lint`, `format:check`,
      `typecheck`, `test`, `test:db` — all exit zero. Confirm every declared root script resolves.
      *Depends on:* 15.1.
- [ ] 16.2 Same clean-checkout run on Linux, to confirm nothing carried is Windows-only.
      *Depends on:* 16.1.
- [ ] 16.3 Confirm Turbo cache behaviour: a second `pnpm typecheck` on an unchanged tree replays from
      cache; `pnpm db:push` run twice never does.
      *Depends on:* 16.2. Satisfies `monorepo-workspace` → "A clean tree replays from cache",
      "Database tasks are never replayed from cache".
- [ ] 16.4 Confirm the build order follows the dependency graph — `shared`, `db` and `ui` build before
      `api` and `web`.
      *Depends on:* 16.3. Satisfies `monorepo-workspace` → "Build order follows the dependency graph".
- [ ] 16.5 Final sweep against the proposal's "Deliberately NOT copied" table: assert each listed item
      is absent from the tree.
      *Depends on:* 16.4.
