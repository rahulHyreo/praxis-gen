# Praxis v2 — agent guidance

Spec: `docs/SPEC.md` (cite §). v1 behaviour reference: `docs/v1-SPEC.md`, only
where `docs/SPEC.md` marks an item `[v1]`.

**Precedence:** code > `docs/SPEC.md` > `openspec/specs/` > `docs/v1-SPEC.md` >
design docs. When docs and code disagree, trust the code.

This file is deliberately narrower than `docs/SPEC.md` (§2). It orients you and
points at the spec; it does not restate it. Read the relevant § before building.

## Non-negotiables

- Domain content is pack configuration. No `claim`/`DCN`/`pay`/`deny` names in
  core services — a guard test enforces this
  (`apps/api/src/__tests__/no-domain-names.test.ts`).
- No hard-coded pass marks, weights, DRI formulas, thresholds, caps, durations,
  renewal periods or progression rules — use the §45.1 config surfaces.
- Scores, DRI results and credential decisions are snapshotted at write; never
  re-derived at read time.
- Attempts, sittings, traces, DRI, credentials, audit and email logs are
  append-only. Authored content is versioned, not edited in place.
- Progression, eligibility, scoring, visibility and RBAC: server-side only. The
  UI renders the returned lock reason **verbatim**.
- Strip answer keys, reference reasoning and assist correctness from every
  trainee-role response.
- AI suggestions are never copied into a submission; require verify +
  resolution.
- A `NULL` decision is a valid **correct** answer, not a missing one.
- No real PHI. No pricing/billing.
- Every state change to content, scores, config, roster, standards or
  credentials → `audit_log`.

## Workflow

- OpenSpec: propose → apply → archive; one domain per change.
- Zod schema first → route → store → viewmodel → view (strict MVVM, no direct
  fetch from a view).
- Drizzle query builder only; no `any`; IDs only via `@platform/db` `ids.ts`.
- Tests for touched acceptance criteria; **coverage is a ratchet** — raise a
  threshold, never lower it, and record the measurement in a comment.
- Git hooks are `develop`'s CI. Never `--no-verify` onto `develop`.
- Governance-needed values (§45.3): ship as config with a default marked "not
  approved", and say so in the PR.
- Branch: `develop`. Commits: `feat|fix|schema|api|ui|store|seed|test|chore|pack`.

## Commands

```bash
pnpm dev | build | lint | typecheck | test | test:db | format:check
pnpm db:push | db:seed | db:migrate | db:studio
```

`pnpm test` runs the per-package suites through Turbo and then the repo-level
tooling suite. `pnpm test:db` runs the api's database suites against an
in-memory PGlite — no Docker, no Postgres, no `TEST_DATABASE_URL` needed.

`pnpm packs:validate` and `pnpm packs:sync` are specified in §42 but **not yet
declared**: the pack validator does not exist, and a script that resolves to
nothing is worse than an absent one.

## State of the repository

Bootstrapped only. Five packages build, lint, typecheck and test; a local Docker
stack runs Postgres, MinIO and Redis; the api answers `GET /api/health` and the
web app renders a shell.

There is **no** schema (§40 starts fresh at `0000_init`), no authentication, no
content, no progression and no trainee-facing behaviour. There is also no
deployment path of any kind — no CI, provisioning, registry or Swarm. §42 still
describes the eventual deployment target; it is deferred, not abandoned.

`packages/db/src/schema.ts` maps every §40 table group to the §41 phase that
adds it. Start there to see where a change belongs.
