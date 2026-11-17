# packs/

Authored domain-pack content. **Data, not a workspace package.**

`docs/SPEC.md` §5: "A domain pack is the unit of domain configuration. Core code
knows packs only through their manifest." That is the architectural claim this
directory exists to make good on — adding a domain, a tab, a field or a
navigator step is a change here, not in `apps/api` or `apps/web`
(§Non-negotiables).

There is deliberately no `package.json`: nothing imports a pack as a module. The
api reads pack content at runtime and `pnpm packs:sync` publishes it to object
storage (`S3_PACKS_BUCKET`). Prettier formats these files; ESLint does not lint
them, because they are authored JSON rather than code.

## Shape of a pack (§5)

```
packs/<pack-id>/
  pack.json             id, version, title, domain, decision vocabulary,
                        reason-code vocabulary, glossary ref,
                        module→week mapping, exam blueprints
  glossary.md           domain terms
  modules/<module-id>/  module metadata, content item refs, quizzes
  flows/<code>/         base bundle + v2–v5 variant folders (§13)
```

Two rules that are easy to get wrong:

- **A pack version is immutable once a cohort is enrolled against it.** Editing
  published content means publishing a new pack version; existing enrolments
  keep theirs unless an admin migrates them, and that migration is audited.
- **Decision vocabulary is pack-authored.** There is no platform-wide Pay/Deny
  enum — the Claims pack declares `decisionOptions: ["pay", "deny"]` and the
  core stores whatever validated string key was submitted. A `NULL` decision is
  a valid _correct_ answer, not a missing one.

## The four launch packs

| Pack                 | Block / weeks       | Contents                                                           | Arrives with                          |
| -------------------- | ------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `foundations/`       | Block 1, weeks 1–4  | US health-system literacy, checkpoint quizzes                      | the Foundations content change (§4.3) |
| `compliance/`        | Block 2, weeks 5–6  | HIPAA, FWA, security awareness, conduct; exam blueprints           | the Compliance Passport change (§27)  |
| `reasoning-generic/` | Block 2, weeks 7–8  | Reasoning Core activities, DRI baseline flow bank                  | the Reasoning Core change (§20, §21)  |
| `claims/`            | Block 3, weeks 9–12 | v1's 93 flows migrated, plus new AI-assisted and integration flows | the v1 import (§46) and §14.3         |

Each directory is empty but for its README until then. `pnpm packs:validate` and
`pnpm packs:sync` (§42) are **not** declared yet either — the validator that
would back them does not exist, and a script name that resolves to nothing is
worse than an absent one.

## Future packs the engine must support without core changes (§5)

Membership & Enrollment Ops · Broker & Group Ops · UM/CM/DM Support Ops ·
Provider Data & Credentialing Ops · RCM Front-End · RCM Back-End · Risk
Adjustment Evidence & Documentation Ops · Patient Access & Throughput.

If supporting one of these needs a change in core code rather than here, that is
the signal something has leaked out of a pack and into the architecture.
