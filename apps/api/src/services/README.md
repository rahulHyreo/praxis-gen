# services/

Business logic. Everything that decides something lives here, not in a route
and not in the web app.

**No pack vocabulary in this directory.** `claim`, `dcn`, `pay` and `deny` are
Claims-pack words; core services are domain-neutral (§Non-negotiables). This is
enforced, not merely requested: `../__tests__/no-domain-names.test.ts` sweeps
this folder and fails with the file, line and term. The allow-list is a declared
array in that test, so an exception is a visible diff.

Rules from `docs/SPEC.md`:

- **One service owns one decision.** §12 is explicit: every consumer asks
  `progression.service.ts` "can this trainee open this, and if not, why" —
  nothing re-implements a gate.
- **No hard-coded standards.** Pass marks, weights, DRI formulas, thresholds,
  attempt caps, durations, renewal periods and progression rules come from the
  versioned config surfaces of §45.1. A literal in logic is a bug.
- **Snapshot at write.** Scores, DRI results and credential decisions are
  written when they happen and never re-derived at read time (§18, §19, §21).
  Store the version ids you judged against.
- **Append-only.** Attempts, sittings, traces, DRI rows, credentials, audit and
  email logs are never updated in place (§37).
- **Audit every state change** to content, scores, config, roster, standards or
  credentials (§37).
- **Drizzle query builder only**, no `any`, identifiers only via
  `@platform/db` `ids.ts` (§38, §40).

§Layout lists the modules this directory will hold: identity, roster, program,
content, progression, flow-bundle, workbench, navigator, scoring, normalization,
reasoning, dri, assessment, mcq, proctoring, recording-retention, passport,
credential, employer, institution, leaderboard, at-risk, reporting, email, audit
and sync. Each arrives with its own change.
