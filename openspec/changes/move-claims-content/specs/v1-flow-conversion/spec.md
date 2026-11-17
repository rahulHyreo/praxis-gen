# v1-flow-conversion

The converter that turns a v1 flow-bundle tree into pack content. Requirements
are written against bundle files and generic answer-key fields; concrete domain
values belong to `claims-pack-content`.

## ADDED Requirements

### Requirement: Conversion is a build-time transform over a read-only source

Conversion SHALL be a repeatable script that reads a v1 flows directory and
writes pack content. The source SHALL be opened read-only and SHALL NOT be
modified, moved or deleted. The source path SHALL be a parameter with no
network access and no database dependency.

#### Scenario: Source is left untouched

- **WHEN** conversion completes against a v1 flows directory
- **THEN** no file under the source path SHALL be created, modified or removed
- **AND** the source's own content hash SHALL be unchanged

#### Scenario: Missing or unreadable source fails before any write

- **WHEN** the configured source path does not exist or cannot be read
- **THEN** conversion SHALL fail with the resolved path in the message
- **AND** it SHALL NOT create or truncate any file in the output directory

### Requirement: Conversion is idempotent

Running conversion twice against an unchanged source SHALL produce byte-identical
output. Output SHALL be deterministic: stable key order, stable file ordering and
no timestamps, absolute paths, hostnames or run ids embedded in pack files.

#### Scenario: Second run produces no diff

- **WHEN** conversion runs twice against the same source
- **THEN** the second run SHALL leave every output file byte-identical
- **AND** `git status` SHALL report no change after the second run

#### Scenario: Re-run removes output orphaned by the source

- **WHEN** a flow or variant no longer exists in the source and conversion re-runs
- **THEN** the corresponding output directory SHALL be removed
- **AND** the removal SHALL be listed in the conversion report

### Requirement: Transform rules are declared and individually testable

Each transform SHALL be a named, separately testable rule. A rule SHALL either
transform, drop or assert — never silently pass content through while reporting
that it acted.

#### Scenario: Every rule is covered by a test

- **WHEN** the test suite runs
- **THEN** each named transform rule SHALL have at least one test asserting its
  output on a fixture
- **AND** each assertion rule SHALL have a test proving it fails on violating input

#### Scenario: An unknown file in a source bundle is reported, not copied blindly

- **WHEN** a source flow directory contains a file the rules do not name
- **THEN** conversion SHALL fail and name the file
- **AND** it SHALL NOT copy the file into the pack

### Requirement: Legacy mode keys are asserted, not blindly renamed

Conversion SHALL **assert** the absence of the legacy `assignment` mode key and
SHALL fail if a future source edit introduces one, rather than report a rename it
did not perform. §16 states the migration renames that key in every variant's
`state.json`, but no such key exists in the source: every `state.json` already
uses `training`, `practice` and `assessment`.

#### Scenario: Absent legacy key passes with a no-op recorded

- **WHEN** no `state.json` contains an `assignment` mode key
- **THEN** conversion SHALL succeed
- **AND** the report SHALL record the rename rule as applied 0 times

#### Scenario: A reintroduced legacy key fails the run

- **WHEN** any source `state.json` contains an `assignment` mode key
- **THEN** conversion SHALL fail and name the file
- **AND** the message SHALL state that `flow_attempt_mode` admits only
  `training`, `practice` and `assessment` (§16)

### Requirement: Field-level conditional visibility is asserted absent

Conversion SHALL assert that every `visibleWhen` is section-level and SHALL fail
on a field-level one. §13 requires field-level `visibleWhen` to be rejected; all
165 occurrences in the source are section-level, so there is nothing to strip.

#### Scenario: Section-level conditions pass through unchanged

- **WHEN** a source `ui.json` declares `visibleWhen` on a section
- **THEN** the converted `ui.json` SHALL carry it unchanged
- **AND** the report SHALL record the count of section-level conditions found

#### Scenario: A field-level condition fails the run

- **WHEN** any source `ui.json` declares `visibleWhen` on a field
- **THEN** conversion SHALL fail, naming the file, section and field
- **AND** no partial output SHALL be left for that flow

#### Scenario: A compound condition fails the run

- **WHEN** a `visibleWhen` is not a single strict-equality comparison (§13, §14.1)
- **THEN** conversion SHALL fail and name the offending condition

### Requirement: Graded values are validated against each variant's own data

Conversion SHALL validate each variant's graded content against the bundle that
actually serves that variant, and SHALL fail any flow whose variants contradict
themselves (§13, variant provider identity).

A navigator `expectedValue` SHALL NOT be required to occur in the variant's
data. An expectation is what the trainee types or selects — a typed number, a
decision key, a picker code — and most such values are nowhere in the subject
data by design, so requiring it would fail valid content in the majority of
bundles. What SHALL be validated instead is every reference that must belong to
the variant: quoted subject refs, step target ids, and a reserved mismatch
block's answer.

#### Scenario: A step naming another variant's subject fails

- **WHEN** a navigator step quotes a subject ref that the data serving that
  variant does not contain
- **THEN** conversion SHALL fail, naming the flow, variant, step and ref
- **AND** the flow SHALL NOT be written to the pack

#### Scenario: A reserved mismatch answer no step expects fails

- **WHEN** a variant's reserved mismatch block sets a `correctValue` that no step
  in the navigator serving that variant expects
- **THEN** conversion SHALL fail, naming the flow, variant and value
- **AND** the message SHALL say the data and the graded steps disagree

#### Scenario: A typed or selected expectation is not required to be in the data

- **WHEN** a step expects a value the trainee types or selects, such as a number
  or a decision key, that does not appear in the subject data
- **THEN** conversion SHALL accept it
- **AND** SHALL NOT report it as a contradiction

#### Scenario: A step target missing from the variant's ui fails

- **WHEN** a navigator step targets a tab, section, field or action id that the
  bundle serving that variant does not define
- **THEN** conversion SHALL fail and name the unresolved id

#### Scenario: Per-variant expectations validate against their own variant

- **WHEN** a flow's variants each expect a different value for the same step
- **THEN** each expectation SHALL be validated against its own variant's data
- **AND** the flow SHALL pass when every variant is internally consistent

### Requirement: Hidden client-side bindings are lifted into pack data

Conversion SHALL lift rendering configuration that v1 holds in client code into
the pack. v1 binds 20 sub-tab ids to 13 bespoke components in a web-app map,
leaving `ui.json` silent about which component renders a sub-tab. Conversion
SHALL write that binding into the converted `ui.json` and SHALL record each
component's observed data paths in the report as the `dataPath` evidence the
phase-C registry needs (§14.2, §5).

#### Scenario: A bound sub-tab gains its component declaration

- **WHEN** a source sub-tab id appears in v1's bespoke-component map
- **THEN** the converted `ui.json` sub-tab SHALL name that component
- **AND** the report SHALL list the binding and the component's observed data paths

#### Scenario: A binding with no matching sub-tab fails the run

- **WHEN** the map binds a sub-tab id that no converted `ui.json` declares
- **THEN** conversion SHALL fail, naming the id
- **AND** the message SHALL state that the binding is unreachable

#### Scenario: An unbound sub-tab gains no declaration

- **WHEN** a source sub-tab id is absent from the map
- **THEN** the converted sub-tab SHALL carry no component name
- **AND** conversion SHALL NOT infer a component from the sub-tab id or title

### Requirement: Every run emits a conversion report

Conversion SHALL emit a committed report recording what it did, so the 456-bundle
diff is reviewable as decisions rather than opaque files. The report SHALL list,
per rule, the counts applied; every file dropped, with the reason; every value
transformed; and the pass-mark evidence per flow.

#### Scenario: Report accounts for every dropped file

- **WHEN** conversion drops a duplicate or dead file
- **THEN** the report SHALL name the file path and the rule that dropped it
- **AND** the number of reported drops SHALL equal the number of files absent
  from the output but present in the source

#### Scenario: Report records no-op rules honestly

- **WHEN** a rule matched nothing
- **THEN** the report SHALL record it as applied 0 times
- **AND** it SHALL NOT be omitted or reported as applied

#### Scenario: Report carries the governance evidence

- **WHEN** conversion strips a pass mark or leaves a governance surface unassigned
- **THEN** the report SHALL record the observed source value against the flow code
- **AND** it SHALL mark the surface as awaiting governance approval (§45.3)

### Requirement: Conversion verifies its own output

The general pack validator does not exist. Conversion SHALL therefore verify its
own output before reporting success: every written file SHALL parse as JSON, and
every structural requirement of `flow-bundle-variant-rules` SHALL hold.

#### Scenario: Unparseable or non-conforming output fails the run

- **WHEN** a written file does not parse, or violates a variant rule
- **THEN** conversion SHALL exit non-zero and name the file and the rule
- **AND** it SHALL NOT report success

#### Scenario: Verification is independent of the writer

- **WHEN** verification runs
- **THEN** it SHALL read the written files from disk rather than reuse the
  in-memory objects that produced them
