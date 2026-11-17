# claims-pack-content

Pack-scoped capability (§5). Domain vocabulary — `pay`, `deny`, `DCN`, `PX_*` —
is permitted here and only here; it is pack data, never core logic.

## ADDED Requirements

### Requirement: Converted flow inventory

`packs/claims/` SHALL contain one `flows/<code>/` directory per v1 flow group,
with the base bundle at the root and one `v<N>/` directory per variant that
survives conversion. The pack SHALL contain **92** flow groups and **456**
bundles (92 base + 364 variant), covering 2,639 distinct subject refs. The
counts cited in §5, §46 and `packs/claims/README.md` (93 flows) are superseded
by v1's registry, which exports 92 flow groups.

#### Scenario: Inventory is complete and counted

- **WHEN** the converted pack is validated
- **THEN** `packs/claims/flows/` contains exactly 92 flow directories
- **AND** the total of base plus variant bundles is 456
- **AND** a flow group with no v1 variants (`DEMO.1`) has no `v<N>/` directory

#### Scenario: Inventory shortfall fails validation

- **WHEN** validation finds fewer than 92 flow directories, or a flow directory
  missing any of `ui.json`, `data.json`, `navigator.json`, `state.json`,
  `result.json`
- **THEN** validation SHALL fail and name every missing path
- **AND** the pack SHALL NOT be published

### Requirement: Flow metadata and the subject index are pack data

Each `flows/<code>/` SHALL carry the flow's name and, per variant, its variant
index and the subject refs that variant populates. Subject refs SHALL be
preserved (§46), because they are what routes a subject to a bundle and variant.

v1 keeps these four facts in the `index.ts` module that assembles each bundle,
not in the five bundle files, so they are lost unless conversion extracts them.
2,639 distinct refs live there and only 460 appear anywhere in a `data.json`, so
dropping `index.ts` would lose the routing for most subjects while every other
check still passed. The flow name is likewise only there: `088.1` is "Pricing PCM
Ticket (PX_088) — Verify & Pay" in `index.ts` and "Edit 088.1 — Pricing PCM
Ticket" in `ui.json`.

#### Scenario: Every flow carries its name and subject index

- **WHEN** the pack is validated
- **THEN** every flow SHALL declare a non-empty name
- **AND** every variant, including the base, SHALL declare at least one subject
  ref and its variant index
- **AND** a flow missing either SHALL fail validation

#### Scenario: A subject resolves to one bundle and variant

- **WHEN** the server resolves a subject ref to the bundle that serves it
- **THEN** the pack's index SHALL identify the flow and the variant
- **AND** the resolution SHALL NOT require reading every bundle's subject data

#### Scenario: A ref claimed by two bundles is reported, not silently accepted

- **WHEN** two bundles claim the same subject ref, making resolution ambiguous
- **THEN** conversion SHALL record each collision in its report as a defect
  needing an authoring decision
- **AND** it SHALL NOT invent a renumbering to resolve it
- **AND** it SHALL NOT drop one of the claims silently

### Requirement: Pack-authored decision vocabulary

`pack.json` SHALL declare `decisionOptions` as every decision key the pack's
content offers a trainee. The core SHALL store the submitted decision as a
validated string key and SHALL NOT contain a platform-wide decision enum (§5).

For this pack that is **three** keys — `deny`, `pay`, `pend` — not the two §5
cites. 87 flows offer `[pay, deny]`; 5 (`6X.1`, `HS1.1`, `RB1.1`, `RB2.1`,
`VCB.1`) also offer `pend`. No rubric expects `pend`: it is a distractor. A
distractor SHALL still be declared, because a trainee must be able to choose a
wrong answer and be scored wrong for it rather than refused.

#### Scenario: Submitted decision is validated against the pack

- **WHEN** a submission carries a decision key
- **THEN** the server SHALL accept it only if it is in the enrolled pack
  version's `decisionOptions`, or is absent
- **AND** an unrecognized key SHALL be refused, server-side

#### Scenario: A distractor decision is accepted and scored wrong

- **WHEN** a trainee submits a declared decision key that the flow's rubric does
  not expect
- **THEN** the submission SHALL be accepted
- **AND** the decision component SHALL score as wrong
- **AND** the submission SHALL NOT be refused as an invalid key

#### Scenario: Every offered key is declared

- **WHEN** the pack is validated
- **THEN** every decision key any `ui.json` offers SHALL appear in
  `decisionOptions`
- **AND** a key a flow offers but the pack omits SHALL fail validation, because
  a trainee could choose it and be refused

### Requirement: A no-decision answer is a correct answer

The converted pack SHALL represent a no-decision answer as `null`, a first-class
**correct** answer and not a missing one (§5, Non-negotiables). v1 encodes it as
the empty string in `expectedDecision`. 6 flows depend on this; 5 carry a
`decision` weight of 20 and are graded on it.

#### Scenario: No-decision expectation is stored as null

- **WHEN** a v1 `result.json` has `expectedDecision: ""`
- **THEN** the converted `result.json` SHALL have `expectedDecision: null`
- **AND** no converted file SHALL contain `expectedDecision: ""`

#### Scenario: A trainee who records no decision scores the decision component

- **WHEN** a flow's expected decision is `null` and the trainee submits without
  a decision
- **THEN** the decision component SHALL score as a match (`NULL == NULL`)
- **AND** the attempt SHALL NOT be treated as unanswered or incomplete

### Requirement: Pack-authored reason-code vocabulary

`pack.json` SHALL declare the reason-code vocabulary as pack data, with a label
per code (§5). It SHALL be the union of the codes v1 holds in core code and the
codes its bundles author — 20 codes — and a rubric or picker SHALL NOT reference
a code absent from it.

v1 splits this vocabulary in two, and the split is the defect: 15 codes sit in a
`REJECT_CODE_CATALOG` in core code, bundles author 19, and 5 of the authored
codes are missing from the catalog. v1's own comment concedes the drift — "a
code missing here is still offered, labelled by its code". One pack-authored
vocabulary removes the drift by construction.

#### Scenario: Rubric reason codes resolve against the vocabulary

- **WHEN** the pack is validated
- **THEN** every `expectedReasonCode` in every `result.json` SHALL appear in
  `pack.json`'s reason-code vocabulary, or be `null`
- **AND** a code with no vocabulary entry SHALL fail validation

#### Scenario: Authored picker codes resolve against the vocabulary

- **WHEN** a converted `ui.json` authors reject codes for its deny panel
- **THEN** every code SHALL appear in `pack.json`'s reason-code vocabulary
- **AND** every code SHALL carry a label, so no code is ever shown to a trainee
  labelled only by itself

#### Scenario: A flow offers the code its own rubric expects

- **WHEN** a flow's rubric expects a reason code
- **THEN** that flow's authored picker SHALL offer that code
- **AND** a flow whose expectation its own picker does not offer SHALL fail
  validation, because the expectation would be unreachable

### Requirement: The reject-code distractor pool is pack data

`pack.json` SHALL supply the distractor pool from which a deny panel's picker is
padded, because reason codes are pack-authored (§5). A flow authors only the
codes it expects — 1 to 3 of them — and the server pads the offered list to at
least `MIN_REJECT_CODE_OPTIONS = 5` before shuffling, so a single-option picker
never gives the answer away. The padding is server-side runtime behaviour, not a
property of the bundle: no converted `ui.json` SHALL be required to author 5
codes.

#### Scenario: A flow authoring one code is valid

- **WHEN** a flow authors a single reject code because that is the only correct
  answer
- **THEN** the pack SHALL be valid
- **AND** validation SHALL NOT require the bundle to author 5 options

#### Scenario: The served picker is padded from the pool

- **WHEN** a deny panel is served to a trainee
- **THEN** the offered list SHALL hold at least `MIN_REJECT_CODE_OPTIONS = 5`
  codes, padded from the pack's vocabulary and shuffled
- **AND** the padding SHALL be decided server-side
- **AND** which option is correct SHALL NOT be derivable from the response

### Requirement: Subject reference format is pack-defined

The pack SHALL keep the `DCN-######` subject-ref format through its own
`formatSubjectRef` prefix (§40). The core SHALL NOT define `formatDcn` or any
equivalent.

#### Scenario: Subject refs survive conversion unchanged

- **WHEN** a v1 bundle references a subject as `DCN-606101`
- **THEN** the converted bundle SHALL carry the identical string
- **AND** the prefix SHALL be declared in `pack.json`, not in core code

### Requirement: Flow pass mark is not pack content

A converted `result.json` SHALL NOT carry `passMark`, because §45.2 moves v1's
`FLOW_PASS_MARK_PCT = 70` to the governance-owned `pass_standards` surface.
Rubric `weights`, `deductions` and attempt caps SHALL remain authored per flow,
because §45.1 assigns them to `result.json` by design.

#### Scenario: passMark is stripped and recorded

- **WHEN** a v1 `result.json` carries `passMark: 70`
- **THEN** the converted `result.json` SHALL omit `passMark` entirely
- **AND** the conversion report SHALL record the observed value against that
  flow code as evidence for the `pass_standards` seed

#### Scenario: Authored rubric weights are preserved exactly

- **WHEN** a v1 rubric declares `weights` and `deductions`
- **THEN** the converted rubric SHALL carry both unchanged
- **AND** no weight, deduction or cap SHALL be normalized, defaulted or merged
  across flows

### Requirement: Flow-to-week mapping ships flagged, not invented

`pack.json` SHALL carry the flow → week mapping surface present but unassigned,
with its default marked **"not approved"**, because the mapping is an open
governance decision (§45.3). No flow SHALL be assigned to a week by this change.

#### Scenario: Unapproved mapping is visible as unapproved

- **WHEN** an admin or governance console reads the pack's week mapping
- **THEN** the surface SHALL exist with no flow assignments
- **AND** it SHALL render a "not approved" badge (§45.1)

#### Scenario: Week assignment is not inferred from flow codes

- **WHEN** conversion runs
- **THEN** it SHALL NOT derive a week, module or scenario assignment from a flow
  code, directory name or source-file comment

### Requirement: Answer keys are authored for stripping, never for trainees

An answer key SHALL live only in a file the trainee-role response strips, and
conversion SHALL NOT relocate one into a payload served to a trainee (§13,
Non-negotiables). The keys are `expectedDecision`, `expectedReasonCode`,
navigator `expectedValue` and field `correctValue`.

#### Scenario: Trainee-role response carries no answer key

- **WHEN** a bundle assembled from converted content is served to a trainee role
- **THEN** `expectedDecision`, `expectedReasonCode`, `expectedValue` and
  `correctValue` SHALL be absent from the response
- **AND** the stripping SHALL be server-side, with the client never filtering it

#### Scenario: Conversion does not move a key into trainee-visible data

- **WHEN** conversion writes `data.json` or `ui.json`
- **THEN** it SHALL NOT copy any answer-key value into either file
- **AND** validation SHALL fail if an answer-key field name appears in subject
  data outside a reserved block

#### Scenario: A reserved mismatch block may hold its own answer

- **WHEN** a `data.json` declares a reserved randomization or mismatch block
  (§13), whose `mismatch.fields[].correctValue` is the value the trainee must
  restore
- **THEN** the key SHALL be permitted at that reserved path and nowhere else in
  subject data
- **AND** the pack SHALL record the reserved paths, so the trainee-role strip is
  known to cover them
- **AND** the trainee-role response SHALL omit `correctValue` while still
  carrying the `displayedValue` the workbench renders

### Requirement: Pack version immutability

A pack version SHALL be immutable once a cohort is enrolled against it. Re-running
conversion against an enrolled version SHALL publish a new version rather than
edit content in place; existing enrolments keep theirs unless an admin migrates
them, and that migration SHALL emit an `audit_log` row (§5, §44).

#### Scenario: Re-conversion against an enrolled version publishes a new version

- **WHEN** conversion output differs from a pack version that has an enrolment
- **THEN** publishing SHALL create a new pack version
- **AND** the enrolled cohort SHALL remain on its original version
- **AND** `pack version published` SHALL be audited (§39)

#### Scenario: Enrolment snapshots the pack version id

- **WHEN** a cohort is enrolled against the claims pack
- **THEN** the pack version id SHALL be snapshotted on the enrolment at write
- **AND** it SHALL NOT be re-derived from `packs/` at read time
