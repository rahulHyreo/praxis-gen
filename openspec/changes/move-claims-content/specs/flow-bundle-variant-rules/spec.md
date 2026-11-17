# flow-bundle-variant-rules

Structural rules a flow bundle and its variant folders must satisfy. Written in
domain-neutral terms: these rules govern any pack's flows, not only the first.

Conversion verifies these rules on its output (`v1-flow-conversion`). Loader-side
enforcement lands with the phase-C bundle-loader change, which SHALL honour the
requirements below.

## ADDED Requirements

### Requirement: A variant folder contains only what varies

A variant folder SHALL NOT contain a file that is semantically identical to the
flow's base file. "Semantically identical" means equal after JSON normalization —
key order and whitespace SHALL NOT make a duplicate count as a difference. A
variant file that duplicates its base is the defect §13 sets out to remove: it is
dead weight that reads as authored intent while changing nothing.

#### Scenario: A duplicate variant file is rejected

- **WHEN** a variant folder contains a file equal to the base after normalization
- **THEN** the pack SHALL be rejected, naming the file
- **AND** conversion SHALL drop such files rather than write them

#### Scenario: Formatting-only differences count as duplicates

- **WHEN** a variant file differs from its base only in key order, indentation or
  whitespace
- **THEN** it SHALL be treated as a duplicate and rejected
- **AND** it SHALL NOT be preserved on the grounds that the bytes differ

#### Scenario: The varying payload is required

- **WHEN** a variant folder exists
- **THEN** it SHALL contain `data.json`
- **AND** a variant folder with no file that differs from its base SHALL be
  rejected as empty of purpose

### Requirement: A variant navigator is permitted only when semantically distinct

A variant `navigator.json` SHALL be rejected when it duplicates the base and
permitted when it is semantically distinct. This narrows §13, which would reject
any variant navigator on the premise that the base is served to every variant.
That premise does not hold: a navigator step may carry a graded,
variant-specific expectation, and the navigator schema has no data-reference
token with which one navigator could express it. In full — **[changed] from §13
as written**:

- A variant `navigator.json` that duplicates the base SHALL be rejected.
- A variant `navigator.json` that is semantically distinct SHALL be permitted,
  and SHALL be the navigator served for that variant.
- A variant with no `navigator.json` SHALL be served the base navigator, as v1.

This removes the real defect — the silently ignored copy — without discarding
graded behaviour. Of 364 source variant navigators, 352 are duplicates, 4 are
distinct but unreachable in v1 and so dead, and 8 are distinct and live.

#### Scenario: A distinct variant navigator is served to its variant

- **WHEN** a variant folder holds a navigator that is semantically distinct from
  the base
- **THEN** bundle assembly SHALL serve that navigator for that variant
- **AND** SHALL serve the base navigator to every variant without one

#### Scenario: A duplicate variant navigator is rejected

- **WHEN** a variant folder holds a navigator equal to the base after
  normalization
- **THEN** the pack SHALL be rejected, naming the file

#### Scenario: A distinct but unreachable variant navigator is not carried

- **WHEN** a source variant navigator is semantically distinct but the v1 module
  never served it
- **THEN** conversion SHALL drop it and record it in the report as dead content
- **AND** the variant SHALL be served the base navigator, preserving v1 behaviour

### Requirement: A variant file is carried only when it is both distinct and live

A variant file SHALL be carried only when it is semantically distinct from its
base **and** v1 served it. "Distinct" and "live" are independent questions, and
this rule SHALL apply to all five bundle files, not to the navigator alone.

#### Scenario: A distinct but unreachable variant file of any type is dropped

- **WHEN** a variant file is semantically distinct from its base but v1 bound the
  base copy for that variant
- **THEN** conversion SHALL drop it and record it in the report as dead content
- **AND** the variant SHALL resolve to the base file, preserving v1 behaviour

#### Scenario: A distinct and live variant file is carried whatever its type

- **WHEN** a variant file is semantically distinct and v1 bound the variant copy
- **THEN** it SHALL be carried and SHALL be the file served for that variant
- **AND** this SHALL hold for `state.json` and `ui.json` as it does for
  `navigator.json` and `data.json`

#### Scenario: Exactly one navigator resolves per variant

- **WHEN** a bundle is assembled for any variant
- **THEN** exactly one navigator SHALL resolve for it
- **AND** step ids, points and completion triggers SHALL come from that one
  navigator only

### Requirement: Conditional visibility is section-level and strict-equality only

A bundle SHALL declare `visibleWhen` only on a section, and only as a single
strict-equality comparison (§13, §14.1). A field-level or compound condition
SHALL be rejected at load time rather than silently ignored as in v1.

#### Scenario: A field-level condition is rejected at load

- **WHEN** a bundle declares `visibleWhen` on a field
- **THEN** the loader SHALL reject the bundle, naming the field
- **AND** it SHALL NOT load the bundle with the condition ignored

#### Scenario: A compound condition is rejected at load

- **WHEN** a `visibleWhen` expresses more than one comparison, or an operator
  other than strict equality
- **THEN** the loader SHALL reject the bundle

### Requirement: Mode keys match the workspace mode enum

A bundle's `state.json` SHALL declare mode configuration only under workspace
mode keys — `training`, `practice`, `assessment`, `embedded`, `demo` (§16). The
legacy `assignment` key and v1's twin `training_mode` enum SHALL NOT appear.

`modeConfig` and `flow_attempt_mode` are distinct and SHALL NOT be conflated.
`flow_attempt_mode` is the narrower attempt enum — `training`, `practice`,
`assessment` — because `embedded` and `demo` are unscored and so never produce
an attempt. A bundle may therefore configure a mode that is not an attempt mode.

#### Scenario: An unknown mode key is rejected

- **WHEN** `state.json` declares a mode key outside the workspace enum
- **THEN** the bundle SHALL be rejected, naming the key and the permitted values

#### Scenario: An unscored mode may be configured

- **WHEN** a bundle configures `demo` or `embedded`
- **THEN** the bundle SHALL be accepted
- **AND** an attempt SHALL NOT be created for a run in that mode
- **AND** validation SHALL NOT require the key to be a `flow_attempt_mode` value

#### Scenario: Modes without a navigator still carry a task statement

- **WHEN** a flow is served in `practice` or `assessment`, where the navigator is
  hidden (§16)
- **THEN** the subject description SHALL be present as the task statement
- **AND** a bundle whose subject description is empty SHALL be rejected

### Requirement: Answer-key fields are confined to strippable files

Answer keys SHALL appear only in the files a trainee-role response strips —
rubric expectations in `result.json`, step expectations in `navigator.json`,
field correctness in `ui.json` field definitions. A bundle SHALL NOT carry an
answer key in subject data.

#### Scenario: An answer key in subject data is rejected

- **WHEN** `data.json` contains an answer-key field outside a reserved block
- **THEN** the bundle SHALL be rejected, naming the path

#### Scenario: A reserved randomization block is exempt

- **WHEN** an answer key sits at a reserved randomization or mismatch path that
  §13 assigns to `data.json`
- **THEN** the bundle SHALL be accepted
- **AND** that path SHALL be covered by the trainee-role strip

#### Scenario: Assembly strips keys for trainee roles

- **WHEN** a bundle is assembled for a trainee role
- **THEN** rubric expectations, navigator expected values, reference reasoning
  and assist correctness flags SHALL be absent from the response
- **AND** the stripping SHALL be decided server-side, by role, not by request

### Requirement: A bespoke sub-tab component is named by the bundle, not by the client

A bundle that needs a bespoke sub-tab SHALL name the component in its `ui.json`.
The client SHALL NOT select a bespoke component from a hidden identifier map —
v1's defect, where 20 sub-tab ids bind to 13 components in the web app and
`ui.json` says nothing (§14.2). Which component renders a sub-tab is pack
configuration, so it SHALL be visible in the pack.

#### Scenario: A bespoke sub-tab declares its component

- **WHEN** a sub-tab is rendered by a bespoke component
- **THEN** its `ui.json` sub-tab SHALL carry the component name
- **AND** a sub-tab whose rendering depends on a client-side id map SHALL be
  rejected

#### Scenario: A sub-tab with no declaration renders from ui.json alone

- **WHEN** a sub-tab carries no bespoke component name
- **THEN** it SHALL render from its declared sections and fields
- **AND** the client SHALL NOT substitute a bespoke component for it

### Requirement: Bespoke components are registered with a declared data contract

A bundle SHALL reference a bespoke sub-tab component only if it is registered in
the workbench component registry with a declared `dataPath` contract the bundle
schema validates (§14.2). An unregistered bespoke component SHALL fail the pack
sweep. The registry and the components are phase-C workbench artifacts; this
requirement is the contract they SHALL satisfy.

#### Scenario: An unregistered bespoke component fails the sweep

- **WHEN** a converted `ui.json` names a bespoke component absent from the registry
- **THEN** the pack sweep SHALL fail, naming the component and the flow
- **AND** the failure SHALL list the `dataPath` contract the component must declare

#### Scenario: A registered component's data path is validated

- **WHEN** a registered bespoke component declares a `dataPath`
- **THEN** the schema SHALL validate that the path resolves in the bundle's data
  for every variant the component is served to
- **AND** a path that resolves in the base but not in a variant SHALL fail

### Requirement: A bundle authors its own vocabulary codes, never the pool

A bundle SHALL author only the vocabulary codes its own grading needs, and the
pack SHALL hold the full vocabulary. A bundle SHALL NOT be required to carry a
distractor pool, and a code it authors SHALL resolve against the pack.

#### Scenario: An authored code outside the pack vocabulary is rejected

- **WHEN** a bundle authors a reason code absent from the pack's vocabulary
- **THEN** the bundle SHALL be rejected, naming the code
- **AND** the message SHALL say the vocabulary is pack-authored (§5)

#### Scenario: Option count is not a bundle constraint

- **WHEN** a bundle authors fewer options than the served minimum
- **THEN** the bundle SHALL be valid
- **AND** the minimum SHALL be satisfied by server-side padding at serve time,
  not by the authored content
