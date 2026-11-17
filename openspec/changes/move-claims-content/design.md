# Design — Move Claims content

See `proposal.md` for motivation and `specs/` for requirements. §41 phase C.

## Context

`packs/claims/` is an empty scaffold. The content it needs is 111.7 MB of
authored JSON in the v1 repo at `apps/api/src/data/flows/`, consumed by v1 as
TypeScript modules: each flow directory holds a five-file base bundle, an
`index.ts` that imports those files and spreads them into one bundle object per
variant, and `v2`–`v5` directories holding the same five filenames again.

Two properties of that layout drive every decision below.

**`index.ts` is the only record of what v1 actually serves.** The variant
directories are not self-describing — a `v3/navigator.json` on disk may or may
not reach a trainee, depending on whether `index.ts` imported it. For 90 of 92
flows the variant bundles are built with the base `navigator` binding, so those
files are inert. For `507.3` and `W-DMX.2` the module imports `navigator2`–
`navigator5` and binds each to its variant. Nothing in the JSON says which case
applies.

**Most variant files are copies.** By normalized-JSON comparison against each
flow's base: `result.json` is identical in 364 of 364 variant folders, `ui.json`
in 360, `state.json` in 360, `navigator.json` in 352. Only `data.json` differs
in all 364 — it is the randomization payload, and the reason variants exist.
`ui.json` is also the bulk of the weight (89 MB of the 111.7 MB), so the copies
are most of the repository cost.

Constraints: no schema, no bundle loader, no workbench and no pack validator
exist yet (`pnpm packs:validate` is specified in §42 but undeclared). The v1
repo is a separate working copy on the same machine, not a dependency. Rubric
weights stay authored per flow (§45.1); the flow pass mark does not (§45.2).

## Goals / Non-Goals

**Goals:**

- `packs/claims/flows/<code>/` holds all 92 flow groups as authored pack data,
  byte-reproducible from the v1 source.
- The three §46 defect fixes are each either performed or asserted — never
  reported as done when the rule matched nothing.
- Graded behaviour is bit-for-bit preserved, including per-variant navigator
  expectations and the no-decision correct answer.
- The 456-bundle diff is reviewable as a set of decisions, via a committed
  conversion report.
- Re-running against an updated v1 source is one command and a diff.

**Non-Goals:**

- The v1 **database**: scenarios, sub-scenarios, MCQ bank, users, attempts.
  Only `data/flows` is on disk, so scenarios → modules is a separate change.
- Weeks 11–12 AI-assisted and integration flows, `reasoning.json` and
  `assist.json` — no v1 source exists (§14.3, phase F).
- The general pack validator, `pnpm packs:sync`, and the bundle loader's
  enforcement of these rules (phase A / phase C).
- The workbench bespoke-component registry and the 13 components themselves.
  This change supplies their `dataPath` evidence, not their implementation.
- Inventing any §45.3 value.

## Decisions

### D1 — A build-time converter with committed output, not a runtime import job

§46 describes `apps/api/src/services/v1-import/` running against a read-only v1
database. That service is the right shape for rows; it is the wrong shape here,
because the source is files in a sibling repo and the destination is `packs/`,
which §5 defines as authored content committed to this repository.

The converter is therefore a Node ESM script under `scripts/`, run on demand
with the v1 flows path as an argument. It adds no runtime dependency to
`apps/api`, needs no database, and its output is reviewed as a diff.

_Alternatives._ A one-off manual conversion was rejected: the transform would not
be reproducible, and a later v1 content fix would mean redoing 456 bundles by
hand with no rule tests. The §46 runtime service was rejected as blocked — it
presumes schema, audit and pack tables that do not exist, so it could not ship
in this phase, and it would put a migration concern inside the API image.

### D2 — Reachability is resolved by static analysis of `index.ts`

Because the JSON cannot say whether a variant file is served, the converter
parses each flow's `index.ts` and records, per variant, which binding the module
uses — for **all five** bundle files, not the navigator alone. v1 builds each
variant's bundle by binding five properties, and each may take the base import
or the variant's own.

Reading only the navigator would be wrong, because "distinct" and "live" are
independent questions and three different combinations occur:

| Flow      | Variant file         | Distinct from base | Bound by v1 | Verdict        |
| --------- | -------------------- | ------------------ | ----------- | -------------- |
| every     | `data.json` (364)    | yes                | yes         | carried        |
| `507.3`   | `navigator.json` (4) | yes                | yes         | carried        |
| `W-DMX.2` | `navigator.json` (4) | yes                | yes         | carried        |
| `W-DMX.2` | `state.json` (4)     | yes                | yes         | carried        |
| `X4.1`    | `ui.json` (4)        | yes                | **no**      | dead — dropped |
| `X4.1`    | `navigator.json` (4) | yes                | **no**      | dead — dropped |
| 352 files | `navigator.json`     | no                 | no          | duplicate      |
| 364 files | `result.json`        | no                 | no          | duplicate      |

`X4.1` is the case that makes this necessary: its variant `ui.json` differs from
base, so a duplicate check alone would carry it — but v1 binds the base `ui`, so
carrying it would change what a trainee sees. A file is carried only when it is
both distinct and live.

The analysis is deliberately narrow and fails loudly: the converter asserts the
file matches the expected module shape, and aborts naming the flow if a flow's
bindings cannot be resolved unambiguously. Guessing here would silently change
what a trainee is graded against. It also pins the expected result — per-variant
navigators only in `507.3` and `W-DMX.2`, per-variant state only in `W-DMX.2` —
so a change in v1's authoring fails the run rather than passing unnoticed.

_Alternatives._ Treating every on-disk variant navigator as live would carry 356
inert files and re-create the §13 defect. Treating every one as dead would break
`507.3` and `W-DMX.2` grading. Checking only the navigator, as this change first
scoped it, would carry `X4.1`'s dead variant `ui.json` and change what its
trainees see. Executing the module to observe its exports was rejected as running
untrusted-by-default source for a build-time read; static matching gives the same
answer without it.

### D3 — §13's variant-navigator rule narrows to "no duplicates"

§13 would reject any variant `navigator.json`. Its premise — that v1 serves the
base navigator to every variant — is false for two flows whose steps carry
variant-specific **graded** values: `507.3` step_004 expects RICHARD / RAUL /
NAOMI / OMAR per variant, and `W-DMX.2` step_010 expects a variant-specific
subject ref. The navigator schema has no data-reference token, so one navigator
cannot express them.

The rule becomes: **reject a variant navigator that duplicates the base; permit
one that is semantically distinct.** This still removes the defect §13 was
written against — the copy that reads as authored intent while changing nothing —
and the invariant the loader cares about still holds: exactly one navigator
resolves per variant. Of 364 source files, 352 duplicates and 4
distinct-but-unreachable ones are dropped; 8 live ones are carried.

This is a **[changed]** departure from §13 as written and must be reflected there
when the bundle loader lands, or the loader will implement the strict rule and
break both flows.

_Alternatives._ Adding a data-reference token to navigator steps
(`expectedValue: "{{data.member.primary.firstName}}"`, resolved at assemble time
against the variant's own data) would satisfy §13 literally and keep one
navigator per flow. It was rejected for now as a larger change: it extends the
navigator schema and the assembly pipeline for 8 files, and a resolver that
silently fails to resolve becomes a grading bug. It remains the better long-term
answer if per-variant navigators spread. Splitting the divergent variants into
separate flow codes was rejected because it inflates the inventory from 92 to
100, changes the week mapping, and loses variant randomization — a trainee could
be served all five as distinct flows.

### D4 — Duplicate detection is semantic, not byte-wise

Comparison is on normalized JSON — recursively key-sorted, re-serialized — so
indentation and key order cannot disguise a copy. This matters: a naive byte
comparison finds 164 of 364 variant navigators "different", but only 12 differ
semantically; the other 152 are reformatted copies. Byte comparison would have
carried 152 inert files and overstated the problem by an order of magnitude.

Normalization is used for comparison only. Files are written preserving their
original key order, so the pack diff against v1 stays readable.

### D5 — The no-decision answer becomes `null`

v1 writes `expectedDecision: ""`. Conversion maps it to `null`, and no converted
file may contain the empty-string form. The distinction is the non-negotiable:
`""` invites later code to read a correct no-decision answer as "didn't answer",
and 5 of the 6 affected flows score the decision component at weight 20.
`DEMO.1`, the sixth, is unscored (weight 0).

### D6 — The flow pass mark leaves pack content

§45.2 moves v1's `FLOW_PASS_MARK_PCT = 70` to the governance-owned
`pass_standards` surface, so `passMark` is stripped from every converted
`result.json` rather than carried as a literal. The observed value per flow (70
in 91 flows, 0 in `DEMO.1`) goes into the report as evidence for that seed, which
lands with phase G.

Rubric `weights` (25 distinct shapes) and `deductions` (3) are **not** touched:
§45.1 assigns them to `result.json`, authored per flow. Normalizing them would
destroy authored intent and invent values.

### D7 — Bespoke sub-tab bindings are lifted into `ui.json`

No source `ui.json` has a `component` key; v1 binds 20 sub-tab ids to 13 bespoke
components in `apps/web/src/features/training/view/workspace/customSubTabRenderers.tsx`.
Which component renders a sub-tab is pack configuration, so conversion writes the
binding into the converted `ui.json` and records each component's observed data
paths as the `dataPath` evidence §14.2's registry needs. A binding whose sub-tab
id no converted bundle declares fails the run as unreachable.

### D10 — The reason-code vocabulary is lifted out of core code and unified

v1 splits the reject-code vocabulary across two places, neither of which is pack
data. 15 codes with labels sit in `REJECT_CODE_CATALOG` in
`packages/shared/src/schemas/reject-codes.ts`; bundles author 19 across their
`ui.json` `denyConfig.rejectCodes`; and 5 of the authored codes are missing from
the catalog. v1's own comment concedes the drift — "Keep this in step when a flow
introduces a new code; a code missing here is still offered, labelled by its
code" — which is a vocabulary that can silently degrade to showing a trainee a
bare code.

§5 says reason codes are pack-authored vocabularies, so the catalog is pack data
in the wrong place, like the bespoke map in D7. Conversion takes the union — 20
codes, each with a label — into `pack.json`. One vocabulary cannot drift from
itself.

The same reading applies to the 28 distinct PX **edit bypass** codes authored in
`f_er_bypass_code` pickers. They are a separate vocabulary from the reject codes
— short (`PX_CB`) rather than long (`PX_RNBE00`), and used to bypass an edit
rather than to deny a claim — so `pack.json` declares them separately.

This also corrects what the reject-code minimum means. §14.1's
`MIN_REJECT_CODE_OPTIONS = 5` is **server-side padding**, not a bundle
constraint: a flow authors only the codes it expects (1 to 3; all 23 deny flows
are under 5) and v1's `reject-code-options.ts` pads from the catalog and
shuffles, so a single-option dropdown cannot give the answer away. An assertion
that bundles carry 5 options would have failed every deny flow in the pack. What
conversion asserts instead is that every authored and expected code resolves
against the vocabulary, and that each flow offers the code its own rubric expects
— which holds for all 23.

### D11 — The subject index is recovered from `index.ts`, per flow

The five bundle files are not the whole bundle. v1's `index.ts` assembles each
variant's bundle object and adds four facts that exist nowhere else: `flowSlug`,
`flowName`, `variantIndex`, and `dcns` — the subject refs that variant populates.

`dcns` is the one that matters most. It is the subject index
`resolveBundleSource(subject)` needs, and §46 requires "DCN- refs preserved".
2,639 distinct refs live in those arrays while only **460** appear anywhere in a
`data.json`, so dropping `index.ts` would have lost the routing for most
subjects — silently, because every other check would still have passed. The flow
name is similarly only there: `088.1` is "Pricing PCM Ticket (PX_088) — Verify &
Pay" in `index.ts` and "Edit 088.1 — Pricing PCM Ticket" in `ui.json`.

Conversion therefore writes a `flows/<code>/flow.json` holding the flow name and,
per variant, its index and subject refs. Stored per flow rather than as one
pack-level reverse map: the reverse map is derivable at load time, and
duplicating 2,639 refs would give the pack two copies of one fact to disagree
about.

Resolving `flowName` needs all three forms v1 uses — an inline literal (85
bundles), a `FLOW_NAME` module constant whose value sits on the next line (75),
and a variant referring to the base bundle's name. The parser resolves each and
fails rather than guessing.

**One collision is reported, not fixed.** `DCN-606105` is claimed by both `ZLL.1`
("Vendor Pricing Reference / Linkage") and `ZLS.1` ("Vendor Pricing Returned"),
and appears in both their `data.json`. Subject routing for it is ambiguous in v1
too. Resolving it means renumbering one flow's claim, which is an authoring
decision — the same reason this change refuses to invent a governance value — so
it goes in the report and to the console. Failing the run instead would block
2,639 refs over one of them, and dropping a claim silently would hide a defect
§46 exists to surface.

### D8 — The report is a committed artifact, not console output

A 456-file diff cannot be reviewed file by file. Each run writes a report
recording, per rule, the count applied — including rules that matched nothing —
plus every dropped file with its reason, every transformed value, the pass-mark
evidence, the bespoke bindings, and the governance surfaces left unapproved.
Reviewing the change means reading the report and spot-checking the diff.

### D9 — Config surfaces (no literals in logic)

| Value                       | Surface                                   | Table / file                                     |
| --------------------------- | ----------------------------------------- | ------------------------------------------------ |
| Flow pass mark              | `pass_standards` (§45.1), default flagged | `pass_standards`                                 |
| Rubric weights, deductions  | authored per flow (§45.1)                 | `packs/claims/flows/<code>/result.json`          |
| Attempt caps + bonus        | authored (§45.1)                          | subject/flow `max_attempts`                      |
| Decision vocabulary         | pack-authored (§5)                        | `packs/claims/pack.json` `decisionOptions`       |
| Reason-code vocabulary      | pack-authored (§5)                        | `packs/claims/pack.json`                         |
| Subject-ref prefix          | pack-authored (§40)                       | `packs/claims/pack.json` `formatSubjectRef`      |
| Flow → week mapping         | open decision (§45.3), flagged            | `packs/claims/pack.json`                         |
| Pack version / enrolment    | §40                                       | `packs`, `pack_versions`, `cohort_pack_versions` |
| Reject-code minimum options | not configurable (§14.1, §45.2)           | `MIN_REJECT_CODE_OPTIONS` in code                |

The converter itself holds no tunable: the source path is an argument, and every
threshold it enforces is a structural rule, not a policy value.

## Risks / Trade-offs

- **36.1 MB committed to git** → Dropping duplicates cuts the pack from 111.7 MB
  to 36.1 MB, a 68% reduction, 67.9 MB of it duplicate `ui.json`. `packs/` is the
  authored content root by §5 and syncs to `S3_PACKS_BUCKET`, so committing is
  the specified design; the deduplication is what makes it tolerable.
- **Dropping 75.6 MB is irreversible in the pack** → The report inventories every
  dropped path with its reason, and the v1 repo remains the untouched source, so
  any drop can be re-examined and the converter re-run.
- **`X4.1`'s 4 distinct-but-unreachable navigators encode intent that never ran**
  → They are dropped to preserve v1 behaviour exactly, and recorded in the report
  as dead content so an author can decide whether the intent should be revived
  as a deliberate change.
- **The converter couples to v1's repo layout** → `index.ts` parsing breaks if v1
  restructures. Mitigated by failing loudly rather than guessing, and by fixtures
  pinning the module shapes the parser accepts.
- **No pack validator exists to catch bad output** → The converter verifies its
  own output, re-reading written files from disk rather than trusting the objects
  that produced them.
- **`92` vs `93` contradicts §5, §46 and the claims README** → The correction is
  stated in the proposal and the spec; those documents need updating when the
  change is archived, or the discrepancy will be read as a conversion bug.
- **Deduplicated variants inherit the base `ui.json`** → Correct today, and
  correct automatically if a future v1 edit makes one diverge, because the
  comparison decides per file per run rather than per flow once.

## Migration Plan

1. Run the converter against the v1 flows path; it fails on any assertion before
   writing output.
2. Review the report: rule counts, dropped files, transformed values, governance
   surfaces.
3. Commit `packs/claims/` and the report together, so the content and the account
   of how it was produced land in one reviewable change.
4. Re-run to confirm idempotence — a clean `git status` is the check.

Rollback is `git revert`: the pack is data, nothing imports it yet, and no
database row depends on it until pack sync runs. Once a cohort is enrolled
against a published pack version, that version is immutable and a re-run
publishes a new version instead (§5) — so rollback-by-revert is only available
before the first enrolment.

## Handoff obligations

Work this change creates for others. None of it can be done here — the tables do
not exist — so it is written down rather than left implied, which is how an
obligation gets lost between changes.

### To the pack-sync change (phase A) — `audit_log`

Publishing a pack version is a must-audit event (§39), and migrating an enrolled
cohort between pack versions is audited (§5). Neither is emitted by this change:
there is no schema, no `audit_log` and no `pack_versions` yet. The pack-sync
change owns both, and `claims-pack-content` states them as requirements so they
are testable when it lands.

### To the pass-standards change (phase G) — the seed

`passMark` is stripped from all 92 flows and the observed value recorded per flow
in the conversion report: **70** in 91 flows, **0** in `DEMO.1`, which is an
unscored demo rather than a missing value. That report is the evidence for the
`pass_standards` seed. The default ships flagged **"not approved"**, because
whether flow pass marks stay at 70 is an open decision (§45.3, §45.1).

### To the bundle-loader change (phase C) — two rules it must honour

1. **The narrowed variant-navigator rule (D3).** A loader implementing §13 as
   written — reject any variant `navigator.json` — rejects `507.3` and
   `W-DMX.2` and breaks their grading. The rule is: reject a variant navigator
   that duplicates its base, permit one that is semantically distinct.
2. **Reachability is not re-derivable from the pack.** The pack no longer
   carries `index.ts`, so "which file does this variant use" is now answered by
   what is present: a variant file exists only when it is served. A loader must
   resolve a missing variant file to the base one.

### To the workbench registry change (§14.2, phase C)

The report lists all 20 sub-tab → component bindings with each component's
observed `dataPath` candidates. Those are candidates, not a declared contract:
the components document their paths in prose, and an empty list means the
component reads the whole `data` blob. The registry work turns them into the
declared contract the bundle schema validates.

### To an author — one content defect

`DCN-606105` is claimed by both `ZLL.1` and `ZLS.1`, so subject routing for it
is ambiguous. Resolving it means renumbering one flow's claim, which is an
authoring decision this change does not make (D11).

## Open Questions

- **Flow → week mapping** (§45.3) — ships unassigned and flagged. Weeks 9–10
  cannot be populated until governance settles it.
- **Whether flow pass marks stay at 70** (§45.3) — the report carries the
  observed values; `pass_standards` seeds in phase G.
- **Scenarios → modules** — needs the v1 database; a separate change, and the
  prerequisite for the week mapping being expressible.
- **Whether §13 is amended or the navigator gains data-reference tokens** — D3
  narrows the rule for now; the token design (D3 alternatives) is the better
  answer if per-variant navigators spread beyond these two flows.
- **Whether the 4 dead `X4.1` navigator divergences should become a real change**
  — an authoring decision, recorded in the report, deliberately not made here.
