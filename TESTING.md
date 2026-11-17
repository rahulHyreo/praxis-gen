# Testing

`docs/SPEC.md` §43 is the authority. This file is the practical version: how to
run things, the conventions that are not obvious, and the register of guard
tests still owed.

## Commands

```bash
pnpm test        # every package through Turbo, with the coverage gate,
                 # then the repo-level tooling suite
pnpm test:db     # the api's database suites, on in-memory PGlite
pnpm test:root   # just the repo-level tooling suite
```

Per package: `pnpm --filter <pkg> test`, or `test:watch` while working.

`pnpm test` is what the git hooks and CI run, so it is the command to measure
against when touching coverage. A bare `vitest run` from a package directory
skips Turbo's `dependsOn: ["^build"]` and will fail to resolve `@platform/db`,
whose `exports` map points at `dist/`.

## Conventions

**No live database in a unit test.** Mock it: `vi.mock("@platform/db")`. A suite
that genuinely needs Postgres gates on `hasTestDb()` / `requireTestDb()` from
`apps/api/src/__tests__/setup.ts` and is skipped when none is attached.

**No network in a web test.** Mock `lib/api.ts`. Every request in the app goes
through that one module (§39), which is precisely what makes this possible — a
`fetch` inside a component could not be replaced without rendering the network.

**Deterministic time.** Fake timers always restored.

**Mark genuine bugs, don't hide them.** `it.fails` / `it.skip` with a
`// BUG:` comment, so a known defect is visible in the run rather than absent
from it.

## The database path

`pnpm test:db` runs the api's database-backed suites against **in-memory
PGlite** — real Postgres compiled to WASM, inside the test process. No Docker,
no Postgres install, no `TEST_DATABASE_URL`.

- `src/__tests__/pglite/global-setup.ts` builds the database once per run from
  `packages/db/drizzle` and snapshots it.
- `src/__tests__/pglite/setup.ts` boots a copy per test file and serves it over
  the Postgres wire protocol, so the app's ordinary `pg.Pool` connects to it
  unmodified. No test-only database client exists.
- Suites are **discovered by content** — any `.test.ts` mentioning
  `hasTestDb`/`requireTestDb` and not mocking `@platform/db` — so adding one
  needs no list kept in step. A list would silently omit a suite someone forgot
  to add, and a test that never runs is invisible.

Set `TEST_DATABASE_URL` yourself to run the same suites against a real Postgres
instead; fork count drops to one, because the setup resets tables between tests.

There are **no migrations yet** (§40 starts fresh at `0000_init`), so the
database comes up empty and the harness reports `0 migration(s)`. That is a
valid state, not a fault.

## Coverage is a one-way ratchet

Every package declares thresholds. **Raise them as coverage rises; never lower
them.** When you raise one, record in the comment what you measured, under which
command, and the margin you left — that is what makes the ratchet auditable.

Floors sit _below_ the measured reading, not on it. A reading is not stable
between identical runs: v1 records its jsdom suite swinging ~0.2pp, and a floor
set just under the higher of two readings failed the next run by 0.01%. Measure
twice.

Deleting covered code trips the gate even though nothing regressed — a low
global average falls when well-tested lines are removed. Offset such a deletion
with real tests rather than lowering a threshold.

If a branch is genuinely unreachable, add a coverage `exclude` with a comment
saying why. That is a reviewable exception; a lowered floor is not.

## Guard tests

`docs/SPEC.md` §43 names six. One is implemented; five are deferred, each
because the code it would assert against does not exist yet. **A guard test with
nothing to assert passes for the wrong reason**, which is worse than an absent
one — it reports a boundary as held when nothing is holding it.

### Implemented

| Guard               | Where                                            | What it enforces                                                                                                                                            |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No domain names** | `apps/api/src/__tests__/no-domain-names.test.ts` | No pack vocabulary (`claim`, `dcn`, `pay`, `deny`) in `services/`, `routes/`, `middleware/` or `lib/`, outside a declared allow-list. §Non-negotiables, §43 |

It landed with the bootstrap deliberately: this repository is built by copying
scaffolding out of v1, which _is_ the claims platform, so this is the change
most able to leak that vocabulary and the moment the guard is cheapest to
establish.

Two things about it worth knowing before you change it. It **tokenizes** rather
than regex-matching, because `payload`, `payer`, `repayment`, `denylist` and
`displayName` must not be flagged while `claimId`, `subjectDcn` and `doPay`
must — and a case-insensitive word-boundary regex gets that wrong, since in
JavaScript the `i` flag applies inside the lookahead too. And it has a test
asserting the sweep **reads a non-zero number of files**, because a sweep that
reads nothing reports no violations and is indistinguishable from a clean tree.

The allow-list is a declared array, never a glob, so an exception is a visible
diff. It is currently empty, and a test asserts that — the moment the first
entry is added, that test fails and forces the author to justify it here.

### Deferred

| §43 guard                                                                                                                                           | Owning capability                         | Why it cannot be written yet                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Answer-key leak sweep** — feed every trainee-role serialiser a bundle containing every reserved key; it must emit none                            | flow bundles / workbench (§13, §24)       | No trainee-facing serialiser exists. Nothing serialises a bundle, an MCQ or an attempt.                                                                             |
| **AI auto-accept** — no code path copies an `assist.json` value into a submission                                                                   | AI-assisted mode (§14.3)                  | No `assist.json`, no suggestion panel and no submission path exist.                                                                                                 |
| **`COMPLETION_TRIGGERS` parity** — the trigger constant and the navigator store agree                                                               | navigator (§15)                           | Neither the constant nor the store exists. §15 adds `reasoning_submitted` and `ai_suggestion_resolved` to both together, and this test is what keeps them together. |
| **Snapshot immutability** — editing a rubric, pass standard or DRI methodology after submit leaves existing attempt, sitting and DRI rows unchanged | scoring / standards / DRI (§18, §19, §21) | No attempts, sittings, rubrics, pass standards or DRI rows exist to snapshot.                                                                                       |
| **HITRUST wording** — the Passport template says "HITRUST CSF-aligned security awareness" and never implies individual HITRUST certification        | Compliance Passport (§27)                 | No Passport template exists. Legally load-bearing wording, so the guard lands with the template.                                                                    |

The pack allow-list sweep (§43's "pack sweep against allow-lists, now
`packs/**`") is also deferred: `packs/` holds four READMEs and no authored
content, and the validator the sweep would use arrives with the packs
capability — which is also when `pnpm packs:validate` becomes a real command.

## What is not here yet

No end-to-end suite. §43 names Playwright, and v1 has one, but it drives v1's
claims endpoints; it is rewritten against §38's routers by a later change. There
is also no CI — the git hooks are `develop`'s CI (§Workflow), and
`.husky/pre-commit` plus `.husky/pre-push` are the gate.
