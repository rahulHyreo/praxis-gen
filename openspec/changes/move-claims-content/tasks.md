# Tasks — Move Claims content

Specs: `specs/claims-pack-content`, `specs/v1-flow-conversion`,
`specs/flow-bundle-variant-rules`. Design decisions cited as D1–D9.

Source path is a converter argument, not a literal:
`D:\My Web Projects\full-stack-projects\praxis\apps\api\src\data\flows`.

## 1. Converter scaffold

- [x] 1.1 Create `scripts/convert-v1-flows/` as a Node ESM entry point taking the
      v1 flows path as a required argument and the pack output root as an
      optional one, defaulting to `packs/claims`. Fail with the resolved path
      when the source is absent or unreadable, before touching the output (D1).
      Depends on: —
- [x] 1.2 Add the `pnpm packs:convert-v1` script to the root `package.json`. Do
      not declare `packs:validate` or `packs:sync` — they are phase A and a name
      that resolves to nothing is worse than an absent one.
      Depends on: 1.1
- [x] 1.3 Build the read-only source reader: enumerate flow directories, skipping
      dotted ones (`.omc`), and assert each holds the five base files. Assert the
      enumeration finds 92 flow groups and 364 variant directories, failing with
      the actual counts (D1, `claims-pack-content` inventory).
      Depends on: 1.1
- [x] 1.4 Write the normalized-JSON comparator: recursive key-sort plus
      re-serialize, used for comparison only, with original key order preserved
      on write (D4).
      Depends on: 1.1

## 2. Reachability analysis

- [x] 2.1 Parse each flow's `index.ts` and resolve, per variant, which binding
      the module uses for **all five** bundle files, not the navigator alone.
      Abort naming the flow when bindings cannot be resolved unambiguously;
      never guess (D2).
      Depends on: 1.3
- [x] 2.2 Extract v1's bespoke sub-tab map from
      `apps/web/src/features/training/view/workspace/customSubTabRenderers.tsx`
      into a sub-tab-id → component table, and read each component's hardcoded
      data paths for the `dataPath` evidence (D7).
      Depends on: 1.3
- [x] 2.3 Assert the reachability result against the known cases: per-variant
      navigators only in `507.3` and `W-DMX.2`, per-variant `state.json` only in
      `W-DMX.2`, per-variant `data.json` everywhere, and no per-variant `ui.json`
      or `result.json` anywhere. Failing this assertion means v1 changed and the
      analysis needs review (D2).
      Depends on: 2.1

## 3. Transform rules

Each rule is separately named and separately testable, and either transforms,
drops or asserts — never passes content through while reporting it acted
(`v1-flow-conversion`).

- [x] 3.1 `drop-duplicate-variant-files`: drop any variant file semantically
      identical to its base. Reject a variant folder left with no differing file,
      and require `data.json` in every surviving one (D4,
      `flow-bundle-variant-rules`).
      Depends on: 1.4
- [x] 3.2 `drop-dead-variant-files`: drop any variant file that reachability
      proves inert, whatever its type; carry only files that are both distinct
      and live. Record each dropped distinct-but-unreachable file as dead
      content (D2, D3 — affects `X4.1`'s variant `ui.json` and `navigator.json`,
      and carries `W-DMX.2`'s variant `state.json`).
      Depends on: 2.1, 3.1
- [x] 3.3 `null-decision`: map `expectedDecision: "" → null` and assert no
      converted file retains the empty-string form (D5).
      Depends on: 1.3
- [x] 3.4 `strip-pass-mark`: remove `passMark` from every converted `result.json`
      and record the observed value per flow code. Leave `weights`, `deductions`
      and attempt caps untouched (D6).
      Depends on: 1.3
- [x] 3.5 `declare-bespoke-components`: write the sub-tab → component binding into
      the converted `ui.json`. Fail on a binding whose sub-tab id no converted
      bundle declares; infer nothing for an unbound sub-tab (D7).
      Depends on: 2.2
- [x] 3.6 `extract-subject-index`: parse each `index.ts` for the flow name, each
      variant's index and its `dcns` array, and write
      `flows/<code>/flow.json`. These exist nowhere in the five bundle files, and
      2,639 refs live here against 460 reachable from `data.json`, so skipping
      this loses the subject routing §46 requires preserved. Resolve all three
      `flowName` forms (inline literal, `FLOW_NAME` constant, base reference).
      Record subject-ref collisions as defects needing an authoring decision
      rather than failing or silently dropping a claim.
      Depends on: 2.1
- [x] 3.7 `prune-orphaned-output`: on re-run, remove output directories whose
      source flow or variant no longer exists, and list each removal
      (`v1-flow-conversion` idempotence).
      Depends on: 3.1

## 4. Assertion rules

- [x] 4.1 `assert-no-field-level-visible-when`: assert all `visibleWhen` are
      section-level and each is a single strict-equality comparison. Fail naming
      file, section and field. Record the section-level count — expected 165
      across 456 `ui.json` files, applied-0-times for the field-level rule.
      Depends on: 1.3
- [x] 4.2 `assert-no-legacy-mode-key`: assert no `state.json` carries an
      `assignment` mode key and that keys are confined to the §16 **workspace**
      modes (`training`, `practice`, `assessment`, `embedded`, `demo`) — not to
      `flow_attempt_mode`'s three, or `DEMO.1`'s legitimate unscored `demo`
      mode would be rejected. Report the rename as applied 0 times rather than
      claiming a rename (§16, `v1-flow-conversion`).
      Depends on: 1.3
- [x] 4.3 `assert-variant-graded-values`: validate, against the bundle actually
      serving each variant, that (a) every subject ref quoted in a step resolves
      in that variant's own data, (b) every step target id resolves, and (c) a
      reserved mismatch block's `correctValue` is expected by some step. Do
      **not** require `expectedValue` to appear in the data: an expectation is
      what the trainee types or selects (`"70"`, `"pay"`, a picker code), so
      that check fails 224 of 456 bundles on valid content (§13 variant
      provider identity).
      Depends on: 3.2
- [x] 4.4 `assert-answer-keys-confined`: fail if an answer-key field name
      appears anywhere in a converted `data.json` **except** the reserved
      `mismatch.fields[].correctValue` path, which §13 authorizes as a
      randomization/mismatch block. All 27 occurrences in the source sit at
      exactly that path, across 5 flows (`507.3`, `FSB.1`, `PPB.2`, `X4.1`,
      `X6.1`); record the reserved paths so the trainee-strip is known to cover
      them (`claims-pack-content`, `flow-bundle-variant-rules`).
      Depends on: 3.1
- [x] 4.5 `assert-unknown-source-files`: fail naming any file in a source flow
      directory that no rule accounts for, rather than copying it blindly.
      Depends on: 1.3
- [x] 4.6 `assert-reason-codes-resolve`: assert every authored reject code and
      every rubric `expectedReasonCode` resolves against the pack vocabulary,
      and that each flow's own picker offers the code its rubric expects. Do
      **not** assert a per-bundle option count: flows author 1–3 codes and the
      server pads to `MIN_REJECT_CODE_OPTIONS = 5` from the pool at serve time,
      so a bundle-level count would fail all 23 deny flows (D10).
      Depends on: 6.1

## 5. Output verification and report

- [x] 5.1 Write the output verifier: re-read every written file from disk — not
      the in-memory objects that produced it — assert it parses, and assert every
      `flow-bundle-variant-rules` requirement holds. Exit non-zero naming file
      and rule (D1, `v1-flow-conversion` self-verification).
      Depends on: 3.1, 3.2, 3.3, 3.4, 3.5
- [x] 5.2 Write the report generator: per-rule counts including zeros, every
      dropped path with its reason, every transformed value, the pass-mark
      evidence per flow, the bespoke bindings with their data paths, and the
      governance surfaces left unapproved (D8).
      Depends on: 5.1
- [x] 5.3 Make output deterministic: stable key and file ordering, and no
      timestamp, absolute path, hostname or run id in any pack file. The report
      may name the source path; pack content may not.
      Depends on: 5.1

## 6. Pack manifest and glossary

- [x] 6.1 Author `packs/claims/pack.json`: id, version, title, domain,
      `decisionOptions: ["deny", "pay", "pend"]` — three keys, lifted from
      `ui.json`'s `decisionConfig.options`; `pend` is offered by 5 flows as a
      distractor and must be declared so choosing it scores wrong rather than
      being refused — the **20**-code reason-code vocabulary with
      labels, the **28**-code PX edit bypass vocabulary, glossary ref and the
      `formatSubjectRef` `DCN-######` prefix (§5, §40).
      Depends on: 3.3
- [x] 6.1a Lift v1's `REJECT_CODE_CATALOG` out of core code into the pack
      vocabulary (D10). v1 splits it: 15 codes in `packages/shared`, 19 authored
      across bundles, 5 of the authored codes missing from the catalog. Take the
      union, carry each code's label, and record the 5 drifted codes and the
      distractor-only `PX_R23090` in the report.
      Depends on: 6.1
- [x] 6.2 Add the flow → week mapping surface to `pack.json`, present but
      unassigned, with its default marked **"not approved"** (§45.3). Assert the
      converter never infers a week, module or scenario from a code, directory
      name or source comment.
      Depends on: 6.1
- [x] 6.3 Author `packs/claims/glossary.md` with the §5 claims terms — PX edits,
      SPS, Non-PAR, PCM ticket, write-off codes — and reference it from
      `pack.json`.
      Depends on: 6.1
- [x] 6.4 Assert every `expectedReasonCode` in every converted `result.json`
      resolves against `pack.json`'s vocabulary or is `null`.
      Depends on: 6.1

## 7. Tests

- [x] 7.1 Build fixtures: a minimal flow with variants, one duplicate-everything
      flow, one with a live per-variant navigator, one with a
      distinct-but-unreachable navigator, one with `expectedDecision: ""`, and
      one violating each assertion rule.
      Depends on: 1.4
- [x] 7.2 Test every transform rule in §3 against the fixtures: one test per rule
      asserting its output, plus a test that each leaves unrelated content
      untouched.
      Depends on: 3.7, 7.1
- [x] 7.3 Test every assertion rule in §4 fails on violating input and passes on
      conforming input, including the two rules expected to match nothing.
      Depends on: 4.6, 7.1
- [x] 7.4 Test idempotence: two runs over one fixture tree produce byte-identical
      output, and a removed source flow prunes its output on re-run.
      Depends on: 5.3, 7.1
- [x] 7.5 Test the report: it accounts for every dropped file, records zero-count
      rules rather than omitting them, and carries the governance evidence.
      Depends on: 5.2, 7.1
- [x] 7.6 Test the no-decision path end to end on a fixture: an expected `null`
      decision scores as a match when the trainee submits no decision, and is not
      treated as unanswered (`claims-pack-content`).
      Depends on: 3.3, 7.1
- [x] 7.7 Test the answer-key boundary: converted content keeps keys only in
      strippable files, and no key reaches `data.json` or `ui.json`.
      Depends on: 4.4, 7.1
- [x] 7.8 Raise the coverage threshold for the new converter package to the
      measured value and record the measurement in a comment. Never lower an
      existing threshold (coverage is a ratchet).
      Depends on: 7.7

## 8. Conversion run and content commit

- [x] 8.1 Run the converter against the v1 source and review the report: expect
      92 flows, 456 bundles, 2,639 subject refs, 352 + 4 navigators dropped, 8
      carried, 364 duplicate `result.json` dropped, 6 flows' decisions nulled.
      Depends on: 5.2, 6.4, 7.8
- [x] 8.2 Verify the size outcome — roughly 36 MB retained from 111.7 MB source,
      about 68% dropped, most of it duplicate `ui.json` — and investigate any
      material deviation before committing (D4 risk).
      Depends on: 8.1
- [x] 8.3 Commit `packs/claims/` and the conversion report in one change, so the
      content and the account of how it was produced land together.
      Depends on: 8.2
- [x] 8.4 Re-run and confirm a clean `git status`, proving idempotence against the
      real source rather than only fixtures.
      Depends on: 8.3

## 9. Handoff obligations

- [x] 9.1 Record the `audit_log` obligation this change creates: publishing a
      pack version is a must-audit event (§39), and pack-version migration of an
      enrolled cohort is audited (§5). Neither can be emitted yet — no schema,
      no `audit_log`, no `pack_versions` (phase A) — so capture them as explicit
      requirements for the pack-sync change rather than leaving them implied.
      Depends on: 8.3
- [x] 9.2 Record the seed obligation: the per-flow pass-mark evidence from the
      report feeds the `pass_standards` seed in phase G, with its default flagged
      "not approved" (§45.1, §45.3). No seed is written here — the table does not
      exist.
      Depends on: 8.3
- [x] 9.3 Record the bundle-loader obligation: the loader must implement the
      narrowed variant-navigator rule from D3, or it will reject `507.3` and
      `W-DMX.2` and break their grading. Carry the `dataPath` evidence to the
      §14.2 registry work.
      Depends on: 8.3
- [x] 9.4 Correct the flow count where the repository asserts 93 — `docs/SPEC.md`
      §5 and §46, and `packs/claims/README.md` — to 92, citing v1's registry.
      Leave a note that §13's variant-navigator rule is narrowed by D3.
      Depends on: 8.3
