# Migrations

Empty on purpose — `meta/_journal.json` exists with **zero entries**, which is
drizzle's own bookkeeping, created by the first `pnpm db:generate`. No migration
has been generated, and the database has no tables.

Both consumers handle that state, and both are verified: `pnpm db:migrate:run`
takes drizzle's normal path and reports "migrations applied" (none), and the
api's PGlite harness reports `0 migration(s)`. `runMigrations()` additionally
tolerates the journal being **absent**, which is the state before anyone has run
`db:generate` at all — otherwise every migrate call, including the compose seed
job, would fail until the first migration landed.

`docs/SPEC.md` §40: **"the v2 migration set starts fresh (`0000_init`)"**. None of
V1's migrations are carried, and none of V1's schema is carried
(`../src/schema.ts` records which table group arrives in which §41 phase). A
separate one-way v1 import job (§46) moves V1's _data_ against a read-only v1
database; it does not bring V1's migration history with it.

This directory is tracked — not merely created by a tool — because three things
read it before any migration exists:

- `drizzle.config.ts` writes generated SQL here (`out: "./drizzle"`).
- `apps/api/vitest.db.config.ts` builds its in-memory PGlite database from this
  directory once per run, which is how the api's database suites need no Docker
  and no `TEST_DATABASE_URL`.
- The `db:migrate:run` and `db:deploy` Turbo tasks declare `drizzle/**` as their
  input.

## Adding a migration

```bash
pnpm db:generate          # diff src/schema.ts against the migration history
pnpm db:migrate           # apply pending migrations
```

Generate migrations; do not hand-write them, and do not edit one that has been
applied anywhere. `pnpm db:push` exists for throwaway local iteration only — it
writes no migration file, so anything it changes is invisible to every other
developer and to the PGlite test database.

Authored content is versioned rather than edited in place, and graded rows are
append-only (§18, §21, §37). A migration that rewrites historical attempt,
sitting, DRI or credential rows contradicts the snapshot doctrine — if one seems
necessary, that is a design problem upstream, not a migration to write.
