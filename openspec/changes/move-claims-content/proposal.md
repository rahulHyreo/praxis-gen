# Move Claims content — convert v1's flow bundles into the v2 pack format

Implements §5, §13, §46; constrained by §16, §45.1, §45.3. §41 phase **C —
Workbench port** ("v1 claims import (§46)").

## Why

`packs/claims/` holds nothing but a README, so Block 3 weeks 9–10 have no
content (§4.3). v1's flow bundles are that content: 118 MB of authored JSON
living in `apps/api/src/data/flows/` of the v1 repo, imported into v1 as
TypeScript modules. They must become pack data — `packs/claims/flows/<code>/` —
before the bundle loader, workbench or any Block 3 behaviour has anything to
serve. §46 requires the move to **fix** three v1 defects rather than carry them.

## What Changes

**Inventory correction.** The source holds **92** flow groups, not the 93 cited
in §5, §46 and `packs/claims/README.md`: 92 `index.ts` modules and 92
`flow<NNNN>Variants` exports in v1's `flow-bundle-registry.ts`. Code is
authoritative over the spec (precedence). Total **456 bundles** = 92 base + 364
variant folders (91 flows × v2–v5; `DEMO.1` has none), covering 2,639 distinct
`DCN-` subject refs.

- **[new] A repeatable converter** reads the v1 flows directory and writes
  `packs/claims/flows/`, with the generated pack content committed as authored
  data. Idempotent and re-runnable, so a later v1 content fix is a re-run and a
  reviewable diff rather than hand work. Its transform rules are unit-tested and
  every run emits a conversion report.
- **[new] `packs/claims/pack.json`** declaring `decisionOptions`, the 20-code
  reason-code vocabulary with labels, the separate 28-code PX edit bypass
  vocabulary, the glossary ref and `formatSubjectRef` keeping `DCN-######`
  (§5, §40).
- **[changed] The decision vocabulary has three keys, not two.** §5, §46 and the
  claims README all say `decisionOptions: ["pay", "deny"]`. 87 flows offer
  exactly that, but 5 — `6X.1`, `HS1.1`, `RB1.1`, `RB2.1`, `VCB.1` — also offer
  `pend`. No rubric expects it, so it is a distractor; it must still be declared,
  because the server validates a submitted decision against `decisionOptions`
  and a trainee who picks the distractor has to be scored wrong rather than
  refused.
- **[changed] The reason-code vocabulary is lifted out of core code.** v1 splits
  it in two, and the split is the defect: 15 codes live in a
  `REJECT_CODE_CATALOG` in `packages/shared`, bundles author 19, and 5 authored
  codes are missing from the catalog — drift v1's own comment concedes ("a code
  missing here is still offered, labelled by its code"). §5 makes reason codes
  pack-authored, so conversion takes the union into `pack.json`, where it cannot
  drift from itself. This also corrects what §14.1's
  `MIN_REJECT_CODE_OPTIONS = 5` governs: it is **server-side padding** from that
  pool, not a bundle constraint. Flows author 1–3 codes — all 23 deny flows are
  under 5 — so asserting the count against bundles would have failed every one
  of them.
- **[changed] Drop duplicate variant files.** A variant folder keeps only what
  genuinely varies. Measured against each flow's base, by normalized-JSON
  comparison: `result.json` 364/364 identical, `ui.json` 360/364,
  `state.json` 360/364, `navigator.json` 352/364. `data.json` differs in all
  364 — it is the randomization payload and the reason variants exist. The
  converted pack keeps a variant file only where it is semantically distinct.
- **[changed] §13's variant-navigator rule narrows.** §13 would have the loader
  reject _any_ variant `navigator.json`, on the premise that v1 serves the base
  navigator to every variant and the v2–v5 copies are ignored. That premise is
  false for two flows: `507.3` and `W-DMX.2` import `v2–v5/navigator.json`
  explicitly, and those steps carry variant-specific **graded** values —
  `507.3` `step_004` `expectedValue` is RICHARD / RAUL / NAOMI / OMAR per
  variant.
  Deleting those 8 files would break grading. The rule becomes: **a variant
  navigator is rejected when it duplicates the base, and permitted when it is
  semantically distinct.** That still removes the real defect — the silently
  ignored copy — and keeps 356 deletions, while the 8 live navigators survive.
  `X4.1`'s 4 variant navigators differ from base but are **not** imported by v1;
  they are dead content and are dropped. The same test applies to all five
  files, not just the navigator: `X4.1`'s 4 variant `ui.json` are likewise
  distinct-but-dead and dropped, while `W-DMX.2`'s 4 variant `state.json` are
  distinct **and** live and so are carried. A file is kept only when it is both.
- **[changed] `NULL` decision made explicit.** v1 encodes "no decision" as the
  empty string `""` in `expectedDecision` (26 bundles, 6 flows, 5 of them with
  `decision` weight 20 — graded). The converter maps `"" → null` so the pack
  states a first-class **correct** no-decision answer rather than an empty
  string that later code could read as "didn't answer" (§5, Non-negotiables).
- **[changed] Flow pass mark leaves pack content.** v1's `result.json` carries
  `passMark` (70 in 91 flows, 0 in `DEMO.1`). §45.2 moves v1's
  `FLOW_PASS_MARK_PCT = 70` to the governance-owned `pass_standards` surface, so
  the converter strips `passMark` and records each observed value in the report
  as evidence for that seed. Rubric **weights** (25 distinct shapes),
  **deductions** (3) and attempt caps stay authored per flow — §45.1 assigns
  them to `result.json` by design.
- **[new] Flow metadata and the subject index become pack data.** The five
  bundle files are not the whole bundle: v1's `index.ts` adds the flow name, the
  variant index and `dcns` — the subject refs each variant populates, which is
  what routes a subject to a bundle. 2,639 distinct refs live there and only 460
  appear anywhere in a `data.json`, so dropping `index.ts` would have lost the
  routing §46 requires preserved, silently. Conversion writes a
  `flows/<code>/flow.json` carrying all of it.
- **One pre-existing defect is reported, not fixed.** `DCN-606105` is claimed by
  both `ZLL.1` and `ZLS.1`, so subject routing for it is ambiguous. The fix is
  an authoring decision — renumbering one flow's claim — so conversion records
  it in the report rather than inventing one or dropping a claim silently.
- **[changed] Bespoke sub-tab bindings move into pack data.** No source
  `ui.json` carries a `component` key; v1 instead binds 20 sub-tab ids to 13
  bespoke components in a web-app map (`customSubTabRenderers.tsx`), so which
  component renders a sub-tab is invisible to the pack — §14.2's defect exactly.
  Conversion writes the binding into the converted `ui.json` and records each
  component's observed data paths as the `dataPath` evidence §14.2's registry
  needs. Building that registry and the components is phase-C workbench work,
  not this change.
- **Two §46 fixes are no-ops on this data, and the converter asserts that rather
  than pretending to act.** Field-level `visibleWhen`: all 165 occurrences
  across 456 `ui.json` files are section-level; there are **zero** field-level
  ones to reject. The legacy `assignment` mode key (§16): **zero** occurrences —
  every `state.json` already uses `training` / `practice` / `assessment`. Both
  become converter assertions that fail the run if a future v1 edit introduces
  one.

**Governance (§45.3) — values not invented here.** The claims **flow → week
mapping** is an open decision, so `pack.json` ships it unmapped with a default
flagged **"not approved"**; weeks 9–10 cannot be assigned until it is settled.
The flow pass mark is likewise flagged where it lands in `pass_standards`.

**Out of scope:** scenarios → modules (that mapping lives in the v1 _database_,
not these files; only `data/flows` is on disk), the weeks 11–12 AI-assisted and
integration flows (§14.3, phase F — they do not exist in v1), `reasoning.json`
and `assist.json` (no v1 source), and the general `pnpm packs:validate`
(phase A). The converter verifies its own output instead.

## Capabilities

### New Capabilities

- `claims-pack-content`: what the converted pack contains and guarantees — flow
  inventory, `pack.json` decision and reason-code vocabulary, `formatSubjectRef`,
  the `NULL` decision as a correct answer, the governance-flagged week mapping,
  and the pass-mark boundary between pack content and `pass_standards`.
- `v1-flow-conversion`: the converter's contract — source resolution,
  idempotence, the per-file transform rules, the assertions that fail a run, and
  the conversion report.
- `flow-bundle-variant-rules`: the structural rules a converted variant folder
  must satisfy — no file that duplicates its base, a navigator only when
  semantically distinct, section-level `visibleWhen` only, and the
  `flow_attempt_mode` keys. Enforcement in the loader lands with the phase-C
  bundle-loader change, which must honour these requirements.

### Modified Capabilities

None — `openspec/specs/` is empty; this is the first content change.

## Impact

- **New:** `packs/claims/pack.json`, `packs/claims/glossary.md`,
  `packs/claims/flows/<code>/` (92 flows), the converter and its tests, and a
  committed conversion report.
- **Source (read-only, not modified):** the v1 repo's
  `apps/api/src/data/flows/`. Nothing in v1 is changed; v1 stays the system of
  record for its own history (§46).
- **Downstream:** the phase-C bundle loader must implement the narrowed
  variant-navigator rule, and `pass_standards` (phase G) seeds from this
  report's pass-mark evidence. `apps/api` and `apps/web` are untouched — this is
  pack data plus a build-time script, which is the §5 claim this directory
  exists to make good on.
- **Risk:** the `92` vs `93` correction propagates to §5, §46 and the claims
  README, which cite 93; and dropping 356 duplicate navigators plus `X4.1`'s 4
  dead ones is irreversible in the pack, so the report inventories every
  deletion.
