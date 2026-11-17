Implementation tasks for `bootstrap-v2-monorepo` (§41 Phase A, first change).

Source V1 repository: `../praxis` — **read-only**. Files are copied out of it; nothing is written
back. Where a task says "carry", it means copy the V1 file and edit only what v2 changes, keeping its
explanatory comments intact (design D1).

Verification convention: a task is done when the command named in it exits zero on a clean checkout.
Order follows design's Migration Plan — git and hooks land before the first substantive commit, so
that no commit bypasses the gate it establishes.

## 1. Repository initialisation

- [x] 1.1 `git init` on branch `develop`; set `core.autocrlf` per `.gitattributes`; make the first
      empty commit so hooks have a parent to compare against.
      _Depends on:_ nothing.
      **Done differently:** the repository already existed when apply began — remote
      `github.com/rahulHyreo/praxis-gen`, branches `develop` and `first-phase` (identical), and commit
      `86f4ef8` carrying the v2 spec and these openspec artifacts. So no init and no empty commit were
      needed: a parent commit already exists. Set `core.autocrlf=true` as specified. Implementation
      proceeds on `first-phase`, not `develop`, per §Workflow's never-commit-straight-to-develop rule.
      Git identity is left to the user's global config (`aliaHyreo`), matching commit `86f4ef8`.
- [x] 1.2 Carry V1's `.gitignore`, `.gitattributes`, `.npmrc`, `.dockerignore`, `.prettierrc`,
      `.prettierignore`, `.shellcheckrc`. Drop V1-local entries (`graphify-out/`, `.omc/`,
      `.agents/`, `secrets/`, `skills-lock.json`, `tools/`); add `docker/env/.env`.
      _Depends on:_ 1.1.
      Also dropped as unearned in v2: `.gitattributes`' `secrets/*_id_rsa -text` rules (no deploy
      key), `.shellcheckrc`'s `SC2119` disable (guarded a `ci/jenkins/` file not carried), and
      `.gitignore`'s Playwright / Vercel / `.ci/` entries (no tool here writes them yet). `packs/` is
      explicitly NOT added to `.prettierignore` or `.dockerignore`, with a comment in each saying why.
- [x] 1.3 Verify `docker/env/.env` and every build/coverage output path are ignored —
      `git status --ignored` lists them, `git check-ignore` confirms each.
      _Depends on:_ 1.2. Satisfies `container-stack` → "No secret is committed".
      Verified with `git check-ignore -v`: `docker/env/.env`, `/.env`, `coverage/`, `dist/`,
      `.turbo/` and `node_modules` each resolve to a named `.gitignore` line, and `git status` lists
      none of them. Also satisfies `container-stack` → "The secrets layer is ignored by git".

## 2. Root toolchain

- [x] 2.1 Root `package.json`: name `praxis`, `private`, `packageManager: pnpm@11.5.0`,
      `engines.node >=20`, the §42 command set from `monorepo-workspace` → "Root command set", and
      V1's root devDependencies (Turbo, Prettier + tailwind plugin, husky, lint-staged, TypeScript
      5.9.3, Vitest, `@vitest/coverage-v8`). Do **not** declare `packs:validate` / `packs:sync`.
      _Depends on:_ 1.2.
      Two deliberate departures from V1's copy: its `"workspaces"` array is dropped (npm-style and
      ignored by pnpm, which reads `pnpm-workspace.yaml`), and `lint:fix` now runs `turbo lint:fix`
      rather than V1's `turbo lint`, which silently never fixed anything. V1's claims and
      feature-specific scripts (`e2e:full`, `loadtest*`, `scenarios:roundtrip`, the backfills) are
      not carried.
      **Amended by task 5.4:** the dependency ranges carried here were later replaced with exact pins
      at V1's resolved versions, which is what D2 actually requires. See 5.4 for why.
- [x] 2.2 Carry `pnpm-workspace.yaml` — `apps/*` + `packages/*`, V1's `allowBuilds` entries, and the
      PGlite `packageExtensions` optional-peer narrowing with its comment.
      _Depends on:_ 2.1. Added a comment recording why `packs/` is absent from the members list.
- [x] 2.3 Carry `turbo.json`: the 18 tasks from `monorepo-workspace` → "Turbo task graph", with
      `build`/`test` output and dependency declarations and `cache: false` on every `db:*` task and
      `dev:setup`.
      _Depends on:_ 2.2. `$schema` points at the version-independent `turborepo.com/schema.json`
      rather than V1's pinned `v2-9-16` URL, which would go stale against our `turbo ^2.9.14`.
- [x] 2.4 Root `tsconfig.json`: ES2022 / ESNext / bundler / `strict`, the six path aliases, `files: []`
      and project references to all five packages.
      _Depends on:_ 2.2.
- [x] 2.5 Root `vitest.workspace.ts` referencing all five package configs.
      _Depends on:_ 2.4.

## 3. packages/shared

- [x] 3.1 `packages/shared` package shell: `package.json` (`@platform/shared`, Zod), `tsconfig.json`,
      `eslint.config.js`, `vitest.config.ts`. Lowest package in the graph, so it lands first.
      _Depends on:_ 2.4. Added `composite: true` to the tsconfig, which the root project references
      require and V1's copy omits.
- [x] 3.2 `src/index.ts` entry point plus the shared error-code module (§38), seeded with the §38
      codes this change can justify and nothing speculative.
      _Depends on:_ 3.1.
      Registers only `VALIDATION_FAILED` and `INTERNAL_ERROR` — the two failures a bootstrap api can
      actually raise — plus the `ApiErrorBody` envelope and the `apiError()` builder so the §38 shape
      lives in one place. The ten codes §§5/12/14.3/17/18/20 name are listed in the module header
      against their owning section and capability, but deliberately **not** registered: an unraised
      code cannot be tested, and once the web app branches on one, renaming it is breaking.
- [x] 3.3 Tests: error codes are unique, exported, and stable string literals.
      _Depends on:_ 3.2. Satisfies `monorepo-workspace` → "Package shells are runnable, not empty".
      19 tests: key/value identity, uniqueness, SCREAMING_SNAKE shape, frozen-ness, the envelope's
      absent-key handling (`"code" in body === false`, not `undefined`), falsy-`details` preservation,
      guard narrowing — plus two guard tests asserting no unraisable code is pre-registered and no
      pack vocabulary appears in any code name.

## 4. packages/db

- [x] 4.1 `packages/db` package shell: `package.json` (`@platform/db`, Drizzle, `pg`, `dotenv`, the
      `./env` `./schema` `./client` `./ids` subpath exports), `tsconfig.json`, `eslint.config.js`,
      `vitest.config.ts`, `drizzle.config.ts`.
      _Depends on:_ 2.4. Also `src/scripts/migrate.ts` (carried, including the wait-for-Postgres
      retry loop that survives a compose boot race) and `src/scripts/deploy.ts`.
      `deploy.ts` is **much simpler than V1's**: V1 needs a four-rule safety model
      (`SKIP_SEED`/`FORCE_SEED`/`NODE_ENV` refusal/`SEED_IF_EMPTY` + a `users`-table probe) purely
      because its seed TRUNCATEs. V2's seed is additive and idempotent by contract, so only
      `SKIP_SEED` is kept, with a comment on what would have to come back if a destructive step ever
      landed.
- [x] 4.2 `src/env.ts` and `src/client.ts` — the `Pool` singleton, with V1's "a real environment
      variable always beats `.env`" precedence.
      _Depends on:_ 4.1. `env.ts` logic is carried byte-for-byte; its header was rewritten because
      V1's names `SENDGRID_API_KEY` and `BETTER_AUTH_*` as examples, neither of which exists in v2.
      `client.ts` drops V1's Vercel/serverless pooling advice, which does not apply to a local stack,
      and keeps `DB_POOL_MAX` with its invalid-value fallback.
- [x] 4.3 `src/ids.ts`: `ensureIdSequences()` and the sequence-backed formatter contract (§40). No
      pack-specific formatter — `formatSubjectRef` is pack-defined and belongs to the packs change.
      _Depends on:_ 4.2.
      Dropped from V1's copy: `formatDcn()`, the `dcn_seq` sequence and the `claims`-table branch of
      `alignIdSequences()` — all three are pack vocabulary. `nextval` is now one shared helper rather
      than three copy-pasted bodies. Header records `formatPassportNumber` / `formatCredentialNumber`
      as §40-proposed and pending §45.3, so neither is invented here.
- [x] 4.4 **Migration scaffolding:** empty, git-tracked `drizzle/` directory ready for `0000_init`
      (§40), with a README stating that v2's migration set starts fresh and that no V1 migration is
      carried.
      _Depends on:_ 4.1. Satisfies `monorepo-workspace` → "Migration directory is empty and ready".
      The README also records the three things that read this directory before any migration exists
      (drizzle.config `out`, the PGlite test database, the `db:migrate:run`/`db:deploy` Turbo inputs),
      which is why it is tracked rather than tool-created.
- [x] 4.5 **Seed scaffolding:** `src/seed.ts` entry point that runs, reports that there is nothing to
      seed yet, and exits zero — so `pnpm db:seed` and the compose seed overlay are wired end to end
      before any table exists. No seed rows: §40's schema groups land with the changes that own them.
      _Depends on:_ 4.2. Exports `runSeed()` for `deploy.ts` to reuse, and closes the pool on both
      the success and failure paths so a seed failure reports its error instead of hanging.
- [x] 4.6 `src/schema.ts` as an empty, exported module with a comment naming §40's table groups and
      the phase that adds each. **No tables.**
      _Depends on:_ 4.1. The header maps all 20 §40 groups to their phase and `[v1]`/`[new]` marking,
      and lists the seven things §40 says V2 drops and must not reintroduce.
- [x] 4.7 Tests: `ensureIdSequences()` is idempotent; the env precedence rule holds; `src/seed.ts`
      exits zero against an empty database.
      _Depends on:_ 4.3, 4.5.
      33 tests pass. `ids.test.ts` mocks `./client.js` (§43: no live database in a unit test) and
      asserts the SQL issued: every `CREATE SEQUENCE` carries `IF NOT EXISTS`, alignment runs after
      creation, every alignment block is `to_regclass`-guarded (which is what makes it safe against
      this schema-less repository), `m > 0` keeps alignment from ever lowering a sequence, and no
      statement names a claims table. Added a round-trip test pairing each formatter with the regex
      `alignIdSequences` recovers it by — a mismatch there would silently align to 0 and reissue live
      identifiers. The **live-database** assertions (a real `ensureIdSequences()` and a real
      `runSeed()` against an empty database) belong to the PGlite suite in task 10.3, which is where
      that harness lives.
      Two of these tests initially failed by matching `env.ts`'s own comments rather than its code;
      they now strip comments first, and the test says why.

## 5. packages/ui

- [x] 5.1 `packages/ui` package shell: `package.json` (`@workspace/ui`, shadcn/ui, radix-ui,
      Tailwind v4, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `next-themes`),
      `tsconfig.json`, `tsconfig.lint.json`, `eslint.config.js`, `vitest.config.ts`,
      `components.json`, and the `./globals.css` `./lib/*` `./components/*` `./hooks/*` exports.
      _Depends on:_ 2.4. Dropped `@turbo/gen` (backs a component generator this bootstrap does not
      carry) and `"turbo"` from `tsconfig.lint.json`'s `include`, which names a directory that does
      not exist in either repo.
- [x] 5.2 Carry the design-token stylesheet locked to shadcn preset `b1aJCZWLY` (§39) and the `cn`
      utility.
      _Depends on:_ 5.1. Carried as `src/styles/globals.css` plus `src/lib/utils.ts`, with
      `components.json` pinning style `radix-luma`, base colour `neutral` and the hugeicons library.
- [x] 5.3 Carry V1's shadcn component set (design Open Question 2 — generated primitives, no domain
      content). Record in the package README that these are generated and how to add more.
      _Depends on:_ 5.2.
      Open Question 2 resolved as the design leaned: carry the full set — 46 components, `lib/utils`,
      `hooks/use-mobile`, the token stylesheet and the jsdom test setup. Verified domain-neutral by
      grep: no `claim`, `dcn`, `pay`, `deny` or `adjudicat*` anywhere in the package. The four files
      that are app compositions rather than primitives (`app-sidebar`, `nav-user`, `login-form`,
      `hold-to-delete-button`) are shadcn registry blocks with demo copy, carried because they carry
      their own tests and the changes that use them will adapt the copy.
- [x] 5.4 Tests: the token stylesheet exposes the preset's variables in both themes; a representative
      component renders; `cn` merges conflicting Tailwind classes correctly.
      _Depends on:_ 5.3. V1's 42 component suites came across with the components: **489 tests, all
      passing**, covering every primitive plus `cn` and `use-mobile`.
      **This task found the drift D2 was written about.** `ToggleGroup` failed on `role="group"`
      because `^1.4.3` resolved `radix-ui` to 1.8.1, which renders single-select toggle groups as
      `role="radiogroup"`. The bug was in the apply step, not the test: task 2.1 carried V1's
      _ranges_ while D2 calls for V1's _resolutions_. A mechanical comparison of installed versions
      found **44 drifted direct dependencies** (`react` 19.2.4→19.3.1, `shadcn` 4.7.0→4.23.0,
      `react-resizable-panels` 4.11.2→4.23.0, `tailwindcss` 4.2.1→4.3.5 among them), so all **63**
      shared direct specifiers across the four `package.json` files are now exact pins at V1's
      resolved versions. 489/489 then passed with no test edited. Upgrades become their own change,
      as D2 intends.

## 6. apps/api shell

- [x] 6.1 `apps/api` package shell: `package.json` (`@platform/api`, Express 4,
      `express-async-errors`, `cors`, Zod, `@platform/db`, `@platform/shared`, `drizzle-orm`; dev:
      `tsx`, PGlite, `supertest`, ESLint, Vitest). Omit `better-auth`, `@sendgrid/mail` and
      `@aws-sdk/*` — no importer yet (design D2).
      _Depends on:_ 3.2, 4.2. All versions exact-pinned at V1's resolutions per 5.4.
- [x] 6.2 `tsconfig.json`, `eslint.config.js`, `turbo.json`.
      _Depends on:_ 6.1. `turbo.json`'s `$schema` repointed off V1's pinned `v2-9-16` URL, as in 2.3.
      V1's `express-async-errors.d.ts` carried — the package ships no types, and without the
      declaration the load-bearing first import does not compile.
- [x] 6.3 `src/index.ts` and `src/server.ts` with `express-async-errors` as the **first** import and a
      load-bearing comment saying why (§38; design Risks). Establish `src/routes/`,
      `src/services/`, `src/middleware/`, `src/lib/`, each with a README naming the § section and
      phase that fills it.
      _Depends on:_ 6.2.
      Written fresh rather than carried: V1's `server.ts` imports 25 claims route modules and its
      `index.ts` starts six feature subsystems. What is carried is the _shape_ — `createServer()`
      separate from the listener so supertest can mount the app without binding a port, and the §38
      middleware order with the error handler last. `index.ts` records why `ensureIdSequences()` is
      **not** called at boot: it would issue DDL, and the api must start and answer `/api/health`
      with no database (§44), which the container healthcheck depends on.
      The four READMEs carry the real constraints for later authors — `services/README.md` states
      the no-domain-names rule and names the guard that enforces it; `routes/README.md` states the
      answer-key stripping rule and the §38 routers still to come.
- [x] 6.4 `GET /api/health` answering 200 with no database, auth or pack dependency; the
      `{ error, details?, code? }` error shape and the ZodError → 422 mapping as middleware (§38).
      _Depends on:_ 6.3.
      One departure from V1 worth flagging: V1 returns `err.message` for a 5xx, which can put a
      connection string, query or path into a client response. V2 returns a fixed "Internal server
      error" with `INTERNAL_ERROR` for any status ≥ 500 and only honours a route's message, `code`
      and `details` below 500. A test asserts an `ECONNREFUSED ... 5432` message does not reach the
      body. Also added a `/api`-scoped 404 so an unknown API path returns the §38 envelope rather
      than Express's HTML page.
- [x] 6.5 Tests (supertest): `/api/health` returns 200 with no database reachable; an unhandled async
      rejection in a route produces the §38 error shape, not a hung request; a ZodError maps to 422.
      _Depends on:_ 6.4. Satisfies `monorepo-workspace` → "API answers its health endpoint".
      15 tests. Health answers 200 with `DATABASE_URL` deleted and with no credentials; a rejected
      async handler becomes a 500 rather than a hung request (the observable proof that
      `express-async-errors` is loaded); the 5xx is logged with method and path; a ZodError maps to
      422 with its issues and `VALIDATION_FAILED`, from both sync and async handlers; a deliberate
      sub-500 keeps its status, code and details; and `errorHandler.length === 4`, since Express
      identifies an error handler by arity and a three-parameter one is silently never called.
      **Found while running these:** a direct `vitest run` fails to resolve `@platform/db`, whose
      exports map points at `dist/`. That is why the Turbo `test` task declares
      `dependsOn: ["^build"]` — `pnpm test` builds upstream first and passes. Not a defect; worth
      knowing before reaching for a bare `vitest`.

## 7. apps/web shell

- [x] 7.1 `apps/web` package shell: `package.json` (React 19, React Router v7, Zustand, TanStack
      Form/Table/Query, Zod, Sonner, `date-fns`, `@workspace/ui`, `@platform/shared`; dev: Vite 7,
      Tailwind v4 Vite plugin, Testing Library, jsdom, ESLint, Vitest). Omit every feature-only
      dependency listed in the proposal's "Deliberately NOT copied" table.
      _Depends on:_ 3.2, 5.2.
      **TanStack Query is NOT included**, despite §Layout naming it: V1 never installed it, so there
      is no resolution that has run in production to pin (D2), and nothing here imports it — the
      reference viewmodel uses plain React state. The change that needs server-state caching adds it.
      `tailwindcss` itself is also absent; it belongs to `packages/ui`, which owns the design system,
      and web needs only `@tailwindcss/vite`.
      I first hand-wrote versions here and in `apps/api`, inventing a nonexistent
      `@tanstack/react-query@5.95.3` that failed the install. A mechanical check of every declared
      version against V1's installs then found **11 more** wrong values (`express` 4.21.2 vs 4.22.1,
      `supertest` 7.0.0 vs 7.2.2, `react-router-dom` 7.9.6 vs 7.15.0, `@types/node` 22.10.0 vs
      22.19.17, …), all now pinned to V1's.
- [x] 7.2 `vite.config.ts`, `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`,
      `eslint.config.js`, `turbo.json`, `index.html`, `components.json`.
      _Depends on:_ 7.1.
      `vite.config.ts` is written lean rather than carried: V1's is ~300 lines of service worker,
      Sentry source-map upload, nginx gzip precompression, sub-path deploy and version.json polling,
      none of which exists in v2. What **is** carried is the `CHOKIDAR_USEPOLLING` watcher — required
      by `container-stack` → "Hot reload works through a Windows bind mount" — and the `/api` proxy
      with `changeOrigin: false`, so a session cookie is scoped to the origin the page is on.
      **`@workspace/ui` is deliberately not aliased in `vite.config.ts`.** It was at first, and the
      build failed: the package's `exports` map sends `./globals.css` to `src/styles/globals.css`,
      and an alias rewrites the bare specifier before the map is consulted, so the import resolved to
      a nonexistent `src/globals.css`. V1 aliases it only in `vitest.config.ts`, where no stylesheet
      is imported; v2 now matches, with a comment recording why.
      `eslint.config.js` carries V1's rules with **one adapted**: V1 bans browser-local date
      formatting in favour of fixed-**IST** formatters, but §7 `[changed]` replaces fixed IST with a
      per-market/per-cohort display zone. The restriction is kept — it matters _more_ now, since
      browser-local formatting yields a third answer belonging to no cohort — but its message now
      points at the zone-aware formatter §7 requires, noting it arrives with the markets/cohorts
      change. V1's `e2e/` override block is dropped (no Playwright suite here).
- [x] 7.3 `src/main.tsx`, `src/App.tsx`, `src/app/router.tsx` as the single route registry (§39), and
      `src/lib/api.ts` as the single API access point with a comment recording that views never call
      `api.*` directly.
      _Depends on:_ 7.2.
      `router.tsx` needed a justified file-scoped `react-refresh/only-export-components` disable: it
      exports both the route table and the component that mounts it, which the rule forbids, but §39
      requires the registry to be in this file. Splitting it to satisfy a hot-reload ergonomic would
      put the route table somewhere the spec does not point.
- [x] 7.4 `src/features/` with a README documenting the strict MVVM `model/` → `viewmodel/` → `view/`
      contract and the §39 v2 feature-folder list, plus one reference feature folder following the
      shape end to end.
      _Depends on:_ 7.3. `system-status/` is the reference: `model/schema.ts` (Zod, no React, no
      fetch) → `viewmodel/useSystemStatus.ts` (the only layer touching `lib/api.ts`) →
      `view/SystemStatusCard.tsx` (renders, decides nothing). Built on the one endpoint that exists.
- [x] 7.5 Application shell rendered from `@workspace/ui` — theme provider, Sonner toaster, the
      mandatory loading and error states (§39).
      _Depends on:_ 7.4. Shell, home and not-found pages render from `@workspace/ui`; Sonner is
      mounted in `App.tsx`. The theme provider is **not** mounted: V1's bootstrap depends on
      `themeCookie.ts`/`accentCookie.ts` and a `basePath` cookie-scoping scheme that do not exist
      here, and `next-themes` defaults correctly without it. The theme feature change mounts it.
- [x] 7.6 Tests: the shell renders with no console error; the router registers its routes; the
      reference feature's viewmodel is tested with `lib/api.ts` mocked (§43 — no network in web
      tests).
      _Depends on:_ 7.5. Satisfies `monorepo-workspace` → "Web app renders a shell".
      17 tests. The viewmodel suite covers loading, success, schema-rejection of a malformed payload,
      a transport failure, a non-`Error` rejection, refetch-clears-error, and a response arriving
      after unmount. The shell suite asserts the home route renders inside the shell with **no
      console error or warning**, the unregistered route falls to the not-found page, the loading
      state exists, and a failed request renders the server's message in a `role="alert"` —
      verbatim, per §12. Plus a boundary test asserting the view neither imports `lib/api.ts` nor
      calls `fetch`.
      Three of my own tests failed first, each for an instructive reason: shadcn's `CardTitle`
      renders a `div` so there is no `heading` role to query; `vi.clearAllMocks()` clears calls but
      **keeps implementations**, so a pending promise leaked into the next test; and
      `import.meta.url` is an `http://` URL under jsdom, so `fileURLToPath` rejects it.
      One lint error was a real design signal, not noise: `react-hooks/set-state-in-effect` rejected
      the synchronous `setLoading(true)` in the effect body. The fix moves the synchronous reset into
      `reload()` — an event handler, where it belongs — leaving the effect to set state only from its
      async callbacks.

## 8. packs/ content root

- [x] 8.1 Create `packs/` with `foundations/`, `compliance/`, `reasoning-generic/` and `claims/`,
      each carrying a README naming its §4.3 week range and the change that will author its content.
      No `package.json` — pack content is data, not a workspace member.
      _Depends on:_ 2.2.
      Each README carries the constraints that pack specifically must honour, not just its week
      table: `compliance` records that exams come from a blueprint, that localization cannot alter a
      proctored assessment, and the exact "HITRUST CSF-aligned" wording a §43 guard will assert;
      `reasoning-generic` records why it is domain-neutral and that the DRI methodology is
      governance-owned config, never a literal; `claims` records the three v1 defects §13/§46 require
      the import to fix, its pack-authored decision vocabulary, and that a NULL decision is a correct
      answer; `foundations` records that a go/no-go exit is counted separately from a failure (§34).
- [x] 8.2 Verify Prettier covers `packs/**` and ESLint does not; `pnpm install` does not treat
      `packs/` as a workspace package.
      _Depends on:_ 8.1, 2.1. Satisfies `monorepo-workspace` → "packs/ is content, not a package" and
      `quality-gates` → "Pack content is formatted, not linted".
      Verified: a misformatted `packs/claims/_probe.json` was caught by `pnpm format:check`;
      `pnpm ls -r` lists only the five packages; and ESLint cannot reach `packs/` by construction,
      since every config is per-package and `packs/` is not one.

## 9. Quality gates — lint, format, staged files

- [x] 9.1 Verify `pnpm lint`, `pnpm format:check` and `pnpm typecheck` all exit zero across the five
      packages, and that `pnpm format:check` also catches a misformatted root config, a `packs/` file
      and a `docs/` file.
      _Depends on:_ 6.5, 7.6, 8.2, 3.3, 4.7, 5.4. Satisfies `monorepo-workspace` → "Formatting covers
      non-package files".
      `pnpm lint` 5/5, `pnpm typecheck` 5/5, `pnpm format:check` clean repo-wide. Planted probes at
      all three non-package locations (`_probe.json` at the root, `packs/claims/_probe.json`,
      `docs/_probe.md`) and `format:check` named all three.
      **Fixed a defect carried from V1 while doing this:** `pnpm lint` reported three warnings from
      `packages/ui/coverage/*.js` — ESLint was linting generated coverage-report output, because
      V1's non-web configs ignore `dist` but not `coverage` (its web config ignores both). Added
      `coverage` to the `globalIgnores` of all four non-web configs. Lint is now zero errors **and**
      zero warnings across the workspace.
- [x] 9.2 Carry `lint-staged.config.mjs` with V1's group-by-owning-package strategy and its full
      rationale comment. `PKG_ROOTS` = the five packages.
      _Depends on:_ 9.1. The two command builders are now named exports (`codeCommands`,
      `dataCommands`) so 9.3 can assert the grouping directly instead of shelling out to lint-staged.
      Added a line to the header recording that `packs/**` gets Prettier only _by design_ (§5), so
      the omission reads as intent rather than an oversight.
- [x] 9.3 Tests for the lint-staged config: a staged file in two different packages produces one
      ESLint invocation per package with package-relative paths; a root-level file produces Prettier
      only; a `packs/` JSON file produces Prettier only.
      _Depends on:_ 9.2. Satisfies all three `quality-gates` → "Staged-file gate" scenarios.
      14 tests, including the three details that break silently if someone "simplifies" this config:
      paths are package-relative (not repo-relative, since `pnpm -C` changes the cwd), eslint is
      always invoked through `pnpm -C` (the binary is not hoisted to the root `node_modules/.bin`),
      and `--config eslint.config.js` is named explicitly (flat config resolves only from the cwd).
      Also covers all five packages, a lookalike path (`packages/dbx`) not matching a package, and a
      mixed root+package batch.
      **These tests needed a home that `pnpm test` actually runs.** Turbo only runs per-package
      suites, so a root-level file is ungated by default — precisely the wrong thing for a file that
      decides what gets linted. First attempt used a separate `vitest.root.config.ts`, which silently
      ran all 569 workspace tests from the wrong cwd, because vitest auto-detects
      `vitest.workspace.ts` and workspace mode overrides `--config`. The root tooling is now a named
      `root-tooling` project inside `vitest.workspace.ts`, run by `pnpm test:root` and chained onto
      `pnpm test`. `monorepo-workspace`'s "Root command set" requirement was updated to record this,
      with a new scenario.

## 10. Test harness and coverage ratchet

- [x] 10.1 Carry V1's `apps/api/vitest.config.ts` fork/heap/parallelism configuration with its
      comments — `pool: "forks"`, `isolate: true`, the `--max-old-space-size` ceiling, and the
      drop-to-one-fork rule when `TEST_DATABASE_URL` is set. Strip V1's threshold values (task 10.5
      sets v2's).
      _Depends on:_ 6.5. Carried with the reasons intact, because both flags are load-bearing rather
      than tuning: a worker **thread** rejects `--max-old-space-size` in `execArgv`, so with threads
      neither the ceiling nor a legible OOM is achievable; and `isolate: true` is what Vitest turns
      into tinypool's `isolateWorkers`, without which the fork is reused and rebuilds exactly the
      heap the ceiling exists to bound (V1 measured ~340 MB per file and a kernel OOM kill 32 minutes
      in).
- [x] 10.2 Carry `apps/api/vitest.db.config.ts` and the `src/__tests__/pglite/` harness — PGlite
      built from `packages/db/drizzle` once per run, a copy per test file, content-based suite
      discovery on `hasTestDb()` / `requireTestDb()`, and the pinned auth/Redis env. Coverage
      disabled.
      _Depends on:_ 10.1, 4.4.
      Two adaptations. `migrations.ts` now treats a **missing** `meta/_journal.json` as zero
      migrations (ENOENT only — any other read failure still throws), because this repository has no
      migrations yet and the harness has to work before the first one exists; it reports
      "0 migration(s)" honestly rather than pretending. And V1's per-file HTTP server for Better
      Auth's JWKS route is **not** carried: there is no authentication yet (§7), so it would serve
      nothing. The pinned env therefore reduces to `REDIS_URL: ""`.
- [x] 10.3 Add a database-gated smoke suite calling `requireTestDb()`, so `pnpm test:db` has real work
      and the harness is proven rather than merely configured. Assert it skips under `pnpm test` and
      runs under `pnpm test:db`.
      _Depends on:_ 10.2. Satisfies `quality-gates` → "Database suites run on PGlite with no setup",
      "A new database suite is picked up automatically", "Unit tests run without a database".
      13 tests, and they are **not** a smoke test in name only — they make the live-database
      assertions task 4.7's unit tests structurally cannot. The unit tests mock the client and assert
      the SQL `ids.ts` _issues_; these assert Postgres _agrees_: that `CREATE SEQUENCE IF NOT EXISTS`
      really is idempotent, that the `to_regclass` guard really does survive a database with none of
      the tables it aligns against (the exact state §40 leaves this repository in — without the
      DO-block guard it fails at parse time), that `nextval` hands back consecutive values, and that
      twenty parallel callers get twenty distinct ids. Plus `runSeed()` against an empty database,
      twice, since the compose seed overlay runs on every `up`.
      Verified both ways: `pnpm test:db` → 13 run; `pnpm test` → 13 skipped, and discovery picked the
      new file up by content with no list edited.
      **One failure worth recording:** `pool.end()` in an `afterAll` _inside_ the first `describe`
      closed the pool before the later blocks ran ("Cannot use a pool after calling end on the
      pool"). An `afterAll` registered in a `describe` fires when that block finishes, not the file;
      it is now file-scoped, with a comment.
- [x] 10.4 Test that a developer's local `.env` cannot change what the database suites see.
      _Depends on:_ 10.3. Satisfies `quality-gates` → "Local environment cannot leak into database
      suites".
      Proven empirically, not just asserted: wrote a root `.env` setting `REDIS_URL` and
      `DATABASE_URL` to values the suite must never see, and all 13 tests still passed — the pinned
      config wins because a real environment variable always beats a `.env` file
      (`packages/db/src/env.ts`). Without the pin a suite could pass on one machine and fail on
      another for reasons nothing in the repository records.
- [x] 10.5 **Lock the coverage ratchet.** Measure every package twice with the command CI runs
      (`pnpm test`), set each floor below the lower reading, and write the comment recording the
      readings, the command and the chosen margin (design D5). Assert V1's values are absent.
      _Depends on:_ 10.3, 3.3, 4.7, 5.4, 7.6. Satisfies all three `quality-gates` → "Coverage is a
      one-way ratchet" scenarios.

      Measured twice under `pnpm test` with Turbo's cache cleared between runs; **both readings
      identical**, and identical again to a third pair taken a day later. Readings and floors
      (statements / branches / functions / lines):

      | package | reading | floor | margin rationale |
      | --- | --- | --- | --- |
      | `shared` | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | two files of pure schemas and constants, no I/O, no timing — cannot swing, so zero slack is intended |
      | `db` | 97.14 / 88 / 100 / 97.14 | 96.5 / 87 / 99 / 96.5 | remainder is `env.ts`'s unreachable `import.meta.url` fallback |
      | `ui` | 95.91 / 92.75 / 95.65 / 95.91 | 95.4 / 92.2 / 95.1 / 95.4 | jsdom + Radix; v1 records ~0.2pp swing, so ~0.5pp kept |
      | `api` | 100 / 88.88 / 100 / 100 | 99 / 88 / 99 / 99 | will grow fastest; one point of slack for a hard-to-reach defensive branch |
      | `web` | 99.51 / 96.29 / 100 / 99.51 | 99 / 95.7 / 99 / 99 | same jsdom caveat as `ui` |

      **Two readings were raised rather than locked low, because the low number was a real gap, not
      a fact about the code.** `shared` read 59.37 and `db` 93.15 purely because their `index.ts`
      barrels were never imported — the tests reached into the implementation module directly.
      `shared`'s test now imports through `../index.js`, which is what a consumer does, taking it to
      100 and making a dropped re-export fail here instead of at the first consumer. `db`'s barrel
      re-exports `client.ts`, which opens a connection pool at import time, so covering it would
      mean doing in a unit test the very thing the exclude list forbids; it is excluded with that
      reason and the asymmetry with `shared` written down, and it is exercised for real by the
      PGlite suite. `web` read **43.75 functions** because `lib/api.ts` — the single API access
      point every feature inherits — had no tests at all; 19 tests for it plus 3 for the root
      composition took web to 99.51 / 96.29 / 100.

      Verified the gate **bites**, not just passes: deleting the `lib/api` suite dropped web to
      80.76 / 90 / 56.25 and failed all four thresholds with explicit messages. Confirmed V1's
      values (api 69.7 / 88.9 / 92.3, web 60.2 / 73.3 / 86.6) appear nowhere.

      **Caused a real defect while applying this, worth recording.** The script that wrote the
      floors used a regex whose lookahead over-matched in `apps/web/vitest.config.ts`, silently
      **deleting its `resolve.alias` block**. Three of four web suites then failed to resolve `@/…`
      and the suite reported 19 tests instead of 39 — a *passing* run with two thirds of the tests
      missing, which is exactly the failure a coverage gate is supposed to catch and which the
      threshold error did surface. Restored with a comment explaining why `@workspace/ui` is aliased
      here but deliberately not in `vite.config.ts`, and verified all five configs kept their
      `setupFiles`, pool and exclude blocks.

## 11. The no-domain-names guard

- [x] 11.1 Write `apps/api/src/__tests__/no-domain-names.test.ts` (§43): sweep core service folders
      for `claim`, `dcn`, `pay`, `deny`; fail naming file, line and term; allow-list as a declared
      array in the test source, not a glob (design D4).
      _Depends on:_ 6.3.
      Split into `no-domain-names.ts` (the matcher) and `.test.ts` (the sweep plus the matcher's own
      tests), because a guard whose matcher is untested is a guard of unknown shape — and this one's
      entire value is firing on the right things while staying quiet on the wrong ones.
      Sweeps `services/`, `routes/`, `middleware/` and `lib/`. §43 names only the service layer, but
      a route that puts a claim in a path or a payload key has leaked the same vocabulary into the
      API surface, which is harder to change later than a service internal.
      **The matcher tokenizes; it does not regex-match.** The obvious implementation — a
      case-insensitive word-boundary match per term — is subtly wrong, and the first version here
      was: in JavaScript the `i` flag applies _inside_ the lookahead too, so `(?![a-z])` means "not
      followed by a letter of either case" and `claimId` silently stops matching. That is the single
      most likely way the vocabulary actually arrives. Tokenizing on camelCase and punctuation makes
      both halves explicit — flags `claim`/`Claim`/`CLAIM`/`claimId`/`subjectDcn`/`doPay()`/
      `subject.claim`/`'deny'`/`DcnRef`, and leaves `payload`/`payer`/`repayment`/`denylist`/
      `displayName`/`okpay` alone. That second list is what keeps the guard alive: a naive
      `includes()` flags `payload`, and a guard that cries wolf gets switched off, which is worse
      than no guard because the boundary then erodes unwatched.
      `ALLOW_LIST` is empty, which is the truthful state — no pack-scoped adapter exists yet — and a
      test asserts it, so the first entry forces a justification.
- [x] 11.2 Tests for the guard itself: a planted violation fails and is named; an allow-listed path
      passes; the guard passes on the real bootstrap tree.
      _Depends on:_ 11.1. Satisfies all three `quality-gates` → "Pack vocabulary is barred from core
      services" scenarios.
      18 tests. Verified against a real planted `services/_probe.service.ts`, which the guard failed
      on with all four occurrences named — `claim` and `dcn` from a _comment_, `claim` from inside
      `resolveClaimId` (camelCase), and `pay` from a string literal — each with file, line and term.
      Also asserts no v1 service, route or fixture was carried over by path, since a mechanical
      rename would pass the sweep while leaving the architecture claims-shaped (design D3).
      **This task found a defect that made the guard worthless, and it is the reason for an extra
      test.** The first version resolved the sweep root with `new URL(...).pathname`, which on
      Windows is percent-encoded — this repository lives under "My Web Projects", so every `fs` call
      threw `ENOENT`, the sweep's `catch` swallowed it, and **zero files were read**. The guard
      passed its own suite and failed to flag the planted violation. Fixed with `fileURLToPath`; the
      `catch` now re-throws anything that is not `ENOENT`; and there is a test asserting the sweep
      reads a non-zero number of files and finds two specific known ones. A sweep that reads nothing
      reports no violations and is indistinguishable from a clean tree.
- [x] 11.3 Write the §43 deferral register in `TESTING.md`: each deferred guard (answer-key leak,
      `COMPLETION_TRIGGERS` parity, snapshot immutability, AI auto-accept, HITRUST wording, pack
      allow-list sweep), its §43 clause and its owning future capability — including the note that no
      trainee-facing payload or submission path exists yet for the answer-key and no-auto-accept
      guards to assert against.
      _Depends on:_ 11.2. Satisfies both `quality-gates` → "Deferred guard tests are recorded, not
      forgotten" scenarios.
      Written as the whole of `TESTING.md` rather than a fragment, so task 14.6 does not rewrite the
      same file twice. The register gives each deferred guard its owning capability, its § anchor and
      **the specific reason it cannot be written yet** — not "later", but "no trainee-facing
      serialiser exists", "neither the constant nor the store exists", "legally load-bearing wording,
      so the guard lands with the template". The document also records the two non-obvious properties
      of the implemented guard (why it tokenizes, why it asserts a non-empty sweep) so a future
      author does not simplify either away.

## 12. Git hooks

- [x] 12.1 `husky` init; carry `.husky/pre-commit` — lint-staged (`--concurrent 1`, 8 GB
      `NODE_OPTIONS`) → workspace typecheck with `GIT_DIR`/`GIT_INDEX_FILE` unset → staged-file
      tests, with all three rationale comments intact.
      _Depends on:_ 9.3, 10.5, 11.2. Husky was already installed by the root `prepare` script during
      task 2.1's install; `core.hooksPath` is `.husky/_`. The heap comment now cites `docs/SPEC.md`
      and `docs/v1-SPEC.md` as the large files, rather than V1's
      `openspec/specs/reference-seed-data/spec.md`, which does not exist here.
- [x] 12.2 Carry `scripts/test-staged.mjs`, which reads the index itself (so `GIT_INDEX_FILE` stays
      set for it) and includes the api database suites.
      _Depends on:_ 12.1.
      Carried with its `REACH` map and the `upperDrive` fix (vitest loads setup files **twice** when
      the cwd's drive letter is lowercase, failing every suite — load-bearing on Windows). Added one
      case V1 has no equivalent of: a staged root-level file (`lint-staged.config.mjs`, `scripts/**`,
      `vitest.workspace.ts`) now runs the `root-tooling` project. Without it, the two files that
      decide what gets linted and tested would be the only ones committable untested. That run uses
      the whole project rather than `vitest related`, since `related` cannot trace a config file to
      the suite importing it.
      Also softened V1's error message: it advises `--no-verify`, which §Workflow forbids onto
      `develop`. The new wording says so.
- [x] 12.3 Carry `.husky/pre-push` — `lint`, `format:check --cache`, `test`, `test:db`, with the
      delete-only-push short circuit and the heap and `GIT_DIR` guards.
      _Depends on:_ 12.2.
- [x] 12.4 **Prove the hooks block.** On Windows: a failing test blocks the commit; a type error
      blocks the commit before the test step; a branch deletion skips verification entirely; a hook
      run inside a linked worktree completes instead of hanging.
      _Depends on:_ 12.3. Satisfies all four `quality-gates` → "Git hooks are the branch's CI"
      scenarios.

      All four exercised for real on Windows, not reasoned about:

      - **Type error blocks, before the tests.** Planted `const broken: number = "not a number"` in
        `packages/shared`, staged it, ran `git commit`: failed at the typecheck step with
        `TS2322` named, never reached `test-staged.mjs`, and `git rev-list --count HEAD` stayed at 1.
      - **Failing test blocks, and is named.** Planted a failing `it` in `error-codes.spec.ts`: the
        hook reported `FAIL src/__tests__/error-codes.spec.ts > planted failure > fails on purpose`
        and no commit was created. The `REACH` map also proved itself here — a `packages/shared`
        change ran `apps/api`, `apps/web`, `packages/shared` *and* the api's PGlite suites.
      - **Delete-only push skips everything.** Fed the hook git's real ref line
        (`(delete) 000…0 refs/heads/gone <sha>`): exited 0 with no output. My first attempt put the
        fields in the wrong order and the hook correctly ran the full gate — the test was malformed,
        not the hook.
      - **Clean commit succeeds.** A gate that only ever blocks is untested in the direction that
        matters most. Committing `TESTING.md` passed all three steps. The commit was then undone
        (`git reset --mixed HEAD~1`), leaving the repository on its single original commit.

      **One claim could not be reproduced, and the comment now says so.** V1 records a linked
      worktree's exported `GIT_DIR` making turbo hang indefinitely on Windows. I created a real
      linked worktree, exported its `GIT_DIR` and `GIT_INDEX_FILE`, cleared Turbo's cache, and ran
      `pnpm typecheck` **unguarded**: it completed in 13s, exit 0. The guard is therefore defensive
      on this toolchain (turbo 2.9.14, git 2.50) rather than currently load-bearing. It is kept — the
      trigger is environment-dependent and the symptom is a hook that never returns — but both hook
      comments now state what was verified instead of asserting a hang. An overstated comment gets
      distrusted and then deleted, which would lose the guard for the wrong reason.

## 13. Local container stack

Scope: a stack that runs on a developer machine under plain `docker compose`. No CI, provisioning,
registry, remote host or Swarm (design D9). §42 is **not** edited — deployment is deferred, not
abandoned (design D10).

- [x] 13.1 Carry `docker/docker-compose.yml` — Postgres 16, MinIO, Redis with the `allkeys-lru`
      ceiling, `requirepass` and the empty-password healthcheck branch — converting V1's `overlay`
      network to `bridge` and **dropping every `deploy:` block**. Project and network name `praxis2`,
      `praxis2`-prefixed named volumes.
      _Depends on:_ 1.2.
- [x] 13.2 Carry V1's **`local`** overlay as `docker-compose.local.yml`, plus `seed` and `debug`. Do
      **not** carry `dev` or `prod`, `nginx.conf`, `host-nginx*.conf`, `docker/preview/`,
      `remote-deploy.sh` or `sync-remote.sh`. Drop the overlay's now-redundant network override (the
      base file is already `bridge`) and drop its `sync` service — that runs the claims flow-bundle
      sync (design D9). Tag locally built images `praxis2-api` / `praxis2-web` and prefix its volumes
      `praxis2`.
      _Depends on:_ 13.1. Satisfies `container-stack` → "No claims-specific service is carried".
- [x] 13.3 Verify no Swarm-only construct survives: no `overlay` driver, no `deploy:` key, and
      `docker compose config` validates with **no Swarm initialized**.
      _Depends on:_ 13.2. Satisfies `container-stack` → "No Swarm-only construct remains".
- [x] 13.4 Verify no remote-deployment surface survives: `docker/` contains no remote-deploy,
      sync-remote, host-nginx, preview or registry script, and no overlay for a deployed environment.
      _Depends on:_ 13.2. Satisfies `container-stack` → "No remote deployment path is carried".
- [x] 13.5 Carry the local overlay's `CHOKIDAR_USEPOLLING` + interval on both app containers, and the
      `node_modules` shadowing fix (named volume for the workspace root, anonymous volume per
      package) with V1's naming rationale intact. Wire `apps/web/vite.config.ts` to read the variable
      and set `server.watch.usePolling`.
      _Depends on:_ 13.2, 7.2.
- [x] 13.6 Carry `docker/env/base.env` and create `local.env`; `APP_ENV` defaults to `local`. Do
      **not** create `dev.env`, `uat.env`, `prod.env`, `preview.env`, `customer.env` or `lt.env` —
      keep the layering mechanism, drop the deployed-environment instances. Replace
      `S3_FLOWS_BUCKET` with `S3_PACKS_BUCKET`; keep `S3_PUBLIC_BUCKET`; set the Redis key prefix to
      `praxis2:`; give the database a v2-distinct name. Remove every fixed display time zone (§7).
      _Depends on:_ 13.2. Satisfies `container-stack` → "Only local env files exist".
- [x] 13.7 **Apply the secrets model (design D11).** Carry no credential that authenticates beyond
      `localhost`: no API key, cloud account key or auth signing secret — v2 has none yet. Put
      obviously-local placeholder container credentials in `local.env`. Rewrite
      `docker/env/README.md` to describe the three layers, mark the placeholders as localhost-only,
      and **drop V1's "repo read access is production root access" warning**, which no v2 committed
      file earns.
      _Depends on:_ 13.6. Satisfies all four `container-stack` → "V1's committed-secret trust model is
      not carried" scenarios.
- [x] 13.8 Set the published host-port defaults to v2's block — Postgres 5433, MinIO 9010 / console
      9011, Redis 6380, api 3002, web 5174, Drizzle Studio 4984 — each still `${VAR:-default}` so it
      is overridable without editing a compose file. Leave in-container ports unchanged so §Layout's
      3001 / 5173 stay free for a host `pnpm dev` (design D6).
      _Depends on:_ 13.6.
- [x] 13.9 Carry `docker/load-env.sh` with its read-loop and the comment explaining why `source`
      cannot be used.
      _Depends on:_ 13.6.
- [x] 13.10 `apps/api/Dockerfile` and `apps/web/Dockerfile` on `oven/bun:1.4-alpine`, built locally
      with no registry step; the `praxis-task` container-job wrapper scoped to migrate and seed only;
      `.vscode/tasks.json` exposing the local stack and job tasks.
      _Depends on:_ 13.9, 6.4, 7.5. Satisfies `container-stack` → "Images build locally", "Container
      jobs go through the wrapper".
- [x] 13.11 Tests for env loading: `local.env` overrides `base.env`; a missing `.env` layer is not an
      error; a value containing spaces survives `load-env.sh` intact; a layered load exports every
      key; `S3_FLOWS_BUCKET` appears nowhere; no display time zone is set globally.
      _Depends on:_ 13.9. Satisfies the `container-stack` → "Layered committed environment files" and
      "Environment loading survives values containing spaces" scenarios, plus "Bucket names reflect
      packs, not flows" and "No fixed display time zone".
- [x] 13.12 Bring the base stack up on a machine with **no Swarm initialized**; confirm Postgres,
      MinIO and Redis each report healthy through their own healthcheck; confirm Redis is reachable
      with `redis-cli` on its published port; confirm the seed overlay creates `S3_PACKS_BUCKET` and
      `S3_PUBLIC_BUCKET`.
      _Depends on:_ 13.10, 4.5. Satisfies `container-stack` → "Base stack comes up with plain
      compose", "Pack bucket is created by the seed overlay".
- [x] 13.13 Bring the stack up with the local overlay; confirm `GET /api/health` answers 200 through
      it, and that a host source edit hot-reloads both api and web **on Windows** — the platform the
      polling fix exists for.
      _Depends on:_ 13.12, 13.5. Satisfies `container-stack` → "Local overlay runs the apps from the
      working tree", "Health check answers on the local stack", and both "Hot reload works through a
      Windows bind mount" scenarios.
- [x] 13.14 **Prove local separation.** Bring the v1 and v2 local stacks up on one machine; assert no
      conflict on compose project name, container name, network, volume, published port or Redis
      keyspace; assert every v2 database URL, bucket name and Redis key resolves to a v2 resource;
      assert `pnpm dev` on the host still binds 3001 and 5173; assert overriding `POSTGRES_PORT` in
      `docker/env/.env` moves the published port with no compose edit.
      _Depends on:_ 13.13. Satisfies all five `container-stack` → "The v2 local stack cannot collide
      with v1's" scenarios.
      Proved with **both stacks genuinely running at once** — v1's was already up on this machine, so
      this was not a simulation. `praxis-postgres-1`:5432 beside `praxis2-postgres-1`:5433,
      `praxis-redis-1`:6379 beside `:6380`, `praxis-minio-1`:9000–9001 beside `:9010`–9011. Disjoint
      on every layer: container names, networks (`praxis_praxis` / `praxis2_praxis2`), volumes
      (`praxis_*` / `praxis2_*`) and images (`praxis-api:local` / `praxis2-api:local`). The v2 api's
      resolved environment names only v2 resources (`praxis2_local`, `praxis2-packs`,
      `praxis2-public`, `praxis2:`). Ports 3001 and 5173 confirmed free for a host `pnpm dev`. A
      `POSTGRES_PORT=5455` in the gitignored `.env` moved the published port with no compose edit.

## 13.x — what the live verification found

Three defects, each of which would have shipped as "looks fine, is not".

**1. `praxis-task migrate` failed: `Module not found "src/scripts/migrate.ts"`.** The `dev` stage
does not `COPY` the source — it expects compose to bind-mount `/repo` — and the `db-init` job had no
volumes. V1 runs that job from its `prod` image, which does copy the source; v2 has no `prod` stage
because it has no deployment target. Fixed by bind-mounting the working tree into `db-init`, which is
also the behaviour you want locally: the job migrates and seeds YOUR tree, not a snapshot baked at
image-build time.

**2. The production migrate runner crashed on a repository with no migrations.** Drizzle's migrator
throws `Can't find meta/_journal.json file` when none has been generated — which is this
repository's designed state (§40 starts the set fresh at `0000_init`). So `praxis-task migrate`,
`pnpm db:migrate:run` and the compose seed job would all have failed until the first migration
landed, and `db-init` chains with `&&`, so the seed would never have run. `runMigrations()` now
_checks for_ the journal and reports "nothing to apply" — checked rather than caught, so a corrupt
journal still surfaces as the fault it is. I had already solved this in the PGlite harness (task
10.2) and missed that the real runner had the same gap.

**3. The api container does not hot-reload, and the comments claimed it did.** This one changed a
requirement. `CHOKIDAR_USEPOLLING` is a **chokidar** setting — Vite and `tsx` honour it, and v1 sets
it on both app containers as though it covered both. The api runs on `bun --watch`, whose watcher is
neither chokidar nor pollable. Verified on Windows: editing `health.ts` on the host produced **no
reload for 60s**, while the same experiment on `HomePage.tsx` produced a Vite HMR update in ~5s. The
bind mount is not at fault — `docker exec grep` confirmed the container reads the edited bytes
immediately; Bun simply never notices. The failure is silent: nothing errors, the endpoint just keeps
serving old code.
Rather than assert a fix that does not exist, the `container-stack` capability now splits the old
"Hot reload works through a Windows bind mount" requirement into three — web reload (works), **the
api's documented limitation** (with scenarios for the staleness and for restart picking it up), and
the `node_modules` shadowing fix. `docker/README.md` and the compose comment state the real
behaviour and give both working paths: restart the api container, or run it on the host with
`pnpm dev`, which is why the port block leaves 3001 and 5173 free.

## 14. Specification and documentation

- [x] 14.1 Create `docs/SPEC.md` holding the full v2 specification **moved** from `CLAUDE.md`, every
      § anchor unchanged — §42's deployment path included and unedited (design D10). Verify no
      section was renumbered, merged or split.
      _Depends on:_ 1.2. Satisfies `container-stack` → "The specification keeps its deployment
      section".
      **Brought forward from its place in the order, because Prettier was damaging the document.**
      `CLAUDE.md` contained **zero** code fences but six aligned plain-text diagrams (the layout
      tree, the §4.1 hierarchy, the §5 pack shape, the §18 rubric formulas, the §23 sitting formulas
      and Appendix A's journey) — it had been pasted from a rendered document and lost them. Prettier
      reflowed every one into unreadable single lines, and `format:check` could not pass without
      either accepting that or ignoring the file. Fixed at the source: all six are now fenced
      ` ```text ` blocks. Verified Prettier is now idempotent on the file, 159 § anchors survive, and
      the alignment is intact. The paste had also left bare `text` and `markdown` words on their own
      lines where fences used to open; those are gone.
- [x] 14.2 Create `docs/v1-SPEC.md` from V1's `docs/SPEC.md`, with a header bounding its authority to
      items `docs/SPEC.md` marks `[v1]` and stating that `docs/SPEC.md` wins on anything `[changed]`.
      _Depends on:_ 14.1.
      **§2 names a file that does not exist.** V1 has no `docs/SPEC.md`; its authoritative
      specification is `docs/SDD-master-spec.md`, which is what was carried. The header records that
      discrepancy explicitly rather than quietly papering over it, and also names the four deeper v1
      documents this one does not supersede (`scoring-and-percentages.md`, `database-schema.md`, and
      the two other SDD documents), so a carried engine's detail can be chased to the right place.
      The header additionally repeats **V1's own warning about this document** — "some numbers there
      have drifted from code (e.g. it says trainee IDs are `HYTR-`; the code emits `HYTE-`). When
      docs and code disagree, trust the code." That drift is live and uncorrected in the copy; it is
      also the exact value task 4.3 had to get right, and `ids.ts` follows the code (`HYTE-`), not
      the document.
- [x] 14.3 Replace `CLAUDE.md` with the Appendix B starter, in the same commit as 14.1 so the
      repository is never in a two-copy state.
      _Depends on:_ 14.1. Satisfies `spec-authority` → "The specification is not duplicated", "The
      duplicate is gone".
      58 KB → ~3.5 KB. Beyond Appendix B's text it adds a short "State of the repository" section —
      what exists, what does not (no schema, auth, content, trainee behaviour, deployment), and a
      pointer to `packages/db/src/schema.ts` as the map from §40 table group to §41 phase, which is
      the fastest way for the next author to find where a change belongs.
- [x] 14.4 Correct `openspec/config.yaml`'s context from "SPEC.md at the repo root" to
      `docs/SPEC.md` (§2 wins — design D7). Flag it in the PR as a documentation correction.
      _Depends on:_ 14.1.
      Also corrected the precedence line in the same block, which said a bare "v1 SPEC": it now
      names `docs/v1-SPEC.md` at its real path, so all three statements of the order (`CLAUDE.md`,
      `openspec/config.yaml`, `README.md`) name the same documents, as `spec-authority` requires.
      Added V1's "trust the code" rule to it as well. `openspec validate --strict` still passes and
      the CLI still reads the config.
- [x] 14.5 Write `README.md` for v2: workspace layout, the §42 command set, how to bring the **local**
      stack up (including the v2 port block and how to override it), `develop` plus the §Workflow
      commit prefixes including `pack`, the §2 precedence order, and a plain statement of what does
      not exist yet — no schema, auth, content or trainee behaviour, and no deployment path of any
      kind. State explicitly that CI, provisioning, registry and Swarm deployment are deferred to a
      later change and that §42 still describes the eventual target, so a narrowed scope is not read
      as a changed plan.
      _Depends on:_ 14.3, 13.13. Satisfies `container-stack` → "The local-only boundary is
      documented".
- [x] 14.6 Write `TESTING.md` for v2: §43 conventions, the PGlite path, the ratchet rule, and the
      task 11.3 deferral register. Do not carry V1's claims-feature testing notes.
      _Depends on:_ 14.5, 11.3.
- [x] 14.7 Tests / checks for the documentation contract: `docs/SPEC.md` and `docs/v1-SPEC.md` exist;
      `CLAUDE.md` no longer carries the numbered sections; every document path named in any statement
      of the precedence order resolves; the orders stated in `CLAUDE.md`, `openspec/config.yaml` and
      `README.md` agree.
      _Depends on:_ 14.6. Satisfies all `spec-authority` scenarios not covered by 14.3.

## 15. Audit log — explicitly none in this change

- [x] 15.1 Record in the PR description that this change emits **no** `audit_log` row and creates no
      §45.1 config surface or §45.3 governance value, with the reason: it changes no content, score,
      configuration, roster entry, standard or credential, and the `audit_log` table itself is
      created by the §37 audit port change later in Phase A. Verify by inspection that no bootstrap
      code path writes an audit row or reads a governance-owned value.
      _Depends on:_ 14.7. Required by the artifact rules so the omission is a recorded decision rather
      than an oversight.

## 16. Acceptance

- [x] 16.1 Clean-checkout run on Windows: `pnpm install`, `build`, `lint`, `format:check`,
      `typecheck`, `test`, `test:db` — all exit zero. Confirm every declared root script resolves.
      _Depends on:_ 15.1.
- [ ] 16.2 Same clean-checkout run on Linux, to confirm nothing carried is Windows-only.
      _Depends on:_ 16.1.
- [x] 16.3 Confirm Turbo cache behaviour: a second `pnpm typecheck` on an unchanged tree replays from
      cache; `pnpm db:push` run twice never does.
      _Depends on:_ 16.2. Satisfies `monorepo-workspace` → "A clean tree replays from cache",
      "Database tasks are never replayed from cache".
- [x] 16.4 Confirm the build order follows the dependency graph — `shared`, `db` and `ui` build before
      `api` and `web`.
      _Depends on:_ 16.3. Satisfies `monorepo-workspace` → "Build order follows the dependency graph".
- [x] 16.5 Final sweep against the proposal's "Deliberately NOT copied" table: assert each listed item
      is absent from the tree.
      _Depends on:_ 16.4.

## 14.x — notes on the documentation

**14.5 `README.md`.** Written for someone arriving at the repository cold. It leads with the state of
things — what exists, what does not, and that deployment is "a deliberately narrowed scope, not a
changed plan" — because that is the question a reader has first and the one a bootstrapped repo
answers worst. It gives both ways to run the apps side by side in a table, since the port split only
makes sense once you see that the container and host ports differ on purpose, and it names the api's
hot-reload limitation rather than letting someone discover it by watching a stale endpoint.

**14.6 `TESTING.md`.** Written in task 11.3 rather than here, to avoid writing the same file twice.
Verified against this task's requirements: §43 conventions, the PGlite path, the ratchet rule with
the measure-twice reasoning, and the deferral register. None of v1's claims-feature testing notes
are carried.

**14.7 The documentation contract is now tested**, in `docs/spec-authority.test.mjs` (70 assertions
in the `root-tooling` project, so `pnpm test` covers it). Beyond existence and agreement, three
assertions exist because something actually went wrong:

- **Fences.** `docs/SPEC.md`'s six ASCII diagrams must each be preceded by ` ```text `, and the
  test checks the alignment of two specific lines. Unfenced, Prettier reflowed them into unreadable
  single lines — which is how the problem was found.
- **§42 intact.** Asserts the deployment section still names Swarm, Jenkins, Ansible and
  `PRAXIS_DEPLOY_ENABLED` (design D10): narrowing a change must not narrow the specification.
- **No duplicate spec.** Asserts `CLAUDE.md` holds fewer than 40 § citations and none of the
  specification's section headings, and is under 12 KB — it was 58 KB when it held the whole thing.

The assertions normalise markdown emphasis and collapse whitespace before matching. An earlier
version compared raw text and failed on "no schema" purely because the README bolds the "no"; a
prose assertion that breaks on reformatting rather than on meaning is worse than none.

## 15.x — the audit-log and governance note, for the PR description

**This change emits no `audit_log` row, and that is correct, not an omission.**
§37 requires an audit row for every state change to content, scores, configuration, roster entries,
standards or credentials. This change makes none of those: it creates a workspace, a test harness,
a guard, two documents and a local container stack. The `audit_log` table itself does not exist —
§40 assigns it to the audit port, later in Phase A — so there is nothing to write to.

**It also introduces no §45.1 config surface and no §45.3 governance value**, so nothing here needs
a "not approved" badge. Every number in the change is infrastructure — heap ceilings, Redis
`maxmemory`, healthcheck intervals, fork counts, published ports, coverage floors — not platform
behaviour.

The one value that _looks_ like a tunable is the coverage threshold set, and it is deliberately a
literal in each `vitest.config.ts` rather than configuration: §43 makes it a ratchet whose every
movement must be reviewable in a diff with a justifying comment. Externalising it would let it be
lowered without review, which is the one thing the ratchet exists to prevent.

Verified by inspection rather than asserted: the only occurrence of `audit_log` anywhere in
`apps/*/src` or `packages/*/src` is the comment in `packages/db/src/schema.ts` mapping §40's table
groups to their §41 phase. No code path writes an audit row, reads a pass standard, a DRI
methodology, a progression rule set, a requirement set or any `*_settings` row, and no hard-coded
pass mark or threshold exists.

## 16.x — acceptance results

**16.1 Clean-checkout run on Windows — all green.** `pnpm install --frozen-lockfile`, then
`build` 4/4, `lint` 5/5 (zero errors, zero warnings), `typecheck` 5/5, `format:check` clean
repo-wide, `test` 7/7 tasks with **679 tests passing** (489 ui · 70 root-tooling · 39 web · 33 db ·
33 api · 15 shared; 13 skipped by design), and `test:db` 13/13 on in-memory PGlite. Every declared
root script resolves.

**16.3 Cache behaviour verified both ways.** A second `pnpm typecheck` on an unchanged tree replayed
entirely from cache (5 cached, `FULL TURBO`, 66 ms); `pnpm db:push` run twice reported
`0 cached` both times, as every `db:*` task sets `cache: false` — a cached replay of a task that
acts on a live database would be a lie.

**16.4 Build order follows the dependency graph.** Read from `turbo build --dry=json` rather than
inferred from log order: `@platform/api#build` depends on `@platform/db#build` and
`@platform/shared#build`; `web#build` depends on `@platform/shared#build` and `@workspace/ui#build`;
the three leaf packages depend on nothing.

**16.5 The "Deliberately NOT copied" boundary is now tested**, in `scripts/not-copied.test.mjs` (part
of the `root-tooling` project, so `pnpm test` covers it). It asserts the absence of v1's services,
routes and web features by path; that `schema.ts` defines no `pgTable` or `pgEnum` and `drizzle/`
holds no `.sql`; that none of the seven §40-dropped constructs is reintroduced; that no v1 claims
script and neither undeclared `packs:*` command appears in any `package.json`; that the 13
feature-only web dependencies and the six api dependencies with no importer are absent; that `ci/`,
`ansible/`, `.github/`, `loadtest/`, `postman/` and the v1-local tooling artefacts are absent — and
that **every dependency is still an exact pin**, which is what stops decision D2 silently unravelling.

### 16.2 Linux run — BLOCKED, not done

This is the one task in the change I could not complete, and it is unchecked rather than quietly
marked done.

The machine is Windows. Its WSL2 Ubuntu distro has `node` v22.22.1 but **no `npm`**, and its
Debian-packaged `corepack` is too old for pnpm 11's ESM entry point — `corepack pnpm install` dies
with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. `npx` inside WSL resolves to the _Windows_ npx
through `/mnt/c` on `PATH` and then fails on the UNC path. Completing the task would mean
`apt install`ing a package manager into the user's WSL environment, which is not mine to do for a
verification step.

I did not attempt it in place: a Linux `pnpm install` into the shared `node_modules` would replace
the platform-specific binaries (esbuild, rollup, lightningcss) and **break the developer's Windows
install**. The attempt used a copy at `/tmp/praxis2-lx` inside WSL, which is harmless and clears on
reboot.

What _is_ verified about cross-platform safety, by other means:

- **The app genuinely runs on Linux.** The api, web and `db-init` containers are
  `oven/bun:1.4-alpine`; `docker exec` confirms `Linux x86_64`, Bun 1.4.4. Inside them,
  `bun install --frozen-lockfile` resolved this repository's exact-pinned lockfile, `praxis-task
migrate` and `praxis-task seed` ran against Postgres, the api served `/api/health`, and Vite served
  the web app with working HMR. So the lockfile, the TypeScript sources and the application boot are
  all exercised on Linux — just through Bun rather than pnpm, and without the test suite.
- **No Windows-only code.** A scan found no drive letter, `win32` reference, `%USERPROFILE%`,
  hard-coded backslash separator or `process.platform` branch anywhere in `apps/*/src`,
  `packages/*/src`, `scripts/` or the configs. `lint-staged.config.mjs` normalises with `path.sep`.
  The three Windows-specific accommodations are Windows-_tolerant_, not Windows-only: `upperDrive` in
  `scripts/test-staged.mjs` is a no-op on a POSIX path, and the `split("\\").join("/")` calls in
  `vitest.db.config.ts` and the guard normalise separators that Linux never produces.

**What remains unproven:** the pnpm, Turbo and Vitest toolchain, and the test suite itself, on Linux.
To close it, run `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db` on any
Linux host with pnpm available — a CI runner would do it as a side effect, which is the natural place
for this to be settled once the deployment change adds one.

## Postscript — the ratchet caught a regression during acceptance

Worth recording, because it is the gate doing exactly what it exists for.

Fixing host-mode tooling (making `packages/db/src/env.ts` read the `docker/env/*` layers, so
`pnpm db:push` and `drizzle-kit` see the same configuration the containers do) added two branches:
the `APP_ENV` layer selection and the repo-root guard on the directory list. `@platform/db`'s branch
coverage fell from 88% to 86.66% and **`pnpm test` failed** on the 87% floor.

The response was the one the doctrine prescribes: three tests that actually execute `loadEnv()` down
each new path — `APP_ENV` unset, `APP_ENV` naming a layer that does not exist, and the committed base
layer — using `vi.resetModules()`, because the loader memoises with a module-level flag and a second
call is otherwise a no-op. Reading is now 97.53 / 87.09 / 100 / 97.53, stable across two runs, and
the floor stayed at 87.

One honest retreat along the way: I first tried a `/* v8 ignore next 5 */` on the untriggerable
`catch` for an unavailable `import.meta.url`. It had no effect — v8 attributes that branch to the
`try`, not to the lines following the comment — so rather than leave a directive that silently does
nothing, it is now a plain comment explaining why the branch is uncovered, with the reasoning
mirrored in the ratchet note.

Also fixed during acceptance: `pnpm db:push` and the other `db:*` tasks could not see `DATABASE_URL`
even when exported, because Turbo filters the environment. Each now declares the database variables
in `passThroughEnv`. Both halves were needed — the env layers so the documented path works with no
shell setup, and `passThroughEnv` so an exported variable works too.
