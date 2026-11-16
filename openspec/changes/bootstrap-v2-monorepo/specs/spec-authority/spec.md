## ADDED Requirements

### Requirement: The build specification lives at docs/SPEC.md

The v2 build specification SHALL live at `docs/SPEC.md`, the path §2 names as the second authority
after the code. Its section numbers (§) are stable anchors and SHALL NOT be renumbered; they are
cited by every OpenSpec artifact, by `CLAUDE.md` and by code comments. [new]

The specification text SHALL exist in exactly one place in the repository. It currently lives in
`CLAUDE.md`; this change moves it, rather than copying it, so the two cannot drift.

#### Scenario: Specification is at the specified path

- **WHEN** the repository is checked out
- **THEN** `docs/SPEC.md` exists and contains the full v2 specification, including every § anchor

#### Scenario: Section anchors are preserved

- **WHEN** `docs/SPEC.md` is compared against the specification text it was moved from
- **THEN** every § number is unchanged, and no section has been renumbered, merged or split

#### Scenario: The specification is not duplicated

- **WHEN** the repository is searched for the specification's section headings
- **THEN** they appear in `docs/SPEC.md` only, and not in a second full copy elsewhere

### Requirement: v1's specification is carried as a reference

`docs/v1-SPEC.md` SHALL carry v1's specification verbatim. §2 makes it authoritative for the
behaviour of carried engines, but **only** where `docs/SPEC.md` marks an item `[v1]`, and only until
the corresponding v2 capability spec exists. [new]

It SHALL be marked as a reference document, not a v2 requirement source, so it cannot be read as
specifying v2 behaviour that `docs/SPEC.md` has changed.

#### Scenario: v1 reference is present and labelled

- **WHEN** `docs/v1-SPEC.md` is opened
- **THEN** it carries v1's specification text and a header stating that it is authoritative only for
  items `docs/SPEC.md` marks `[v1]`, and that `docs/SPEC.md` wins wherever it marks something
  `[changed]`

#### Scenario: A [changed] item resolves to v2

- **WHEN** a behaviour is marked `[changed]` in `docs/SPEC.md` and described differently in
  `docs/v1-SPEC.md`
- **THEN** the precedence order makes `docs/SPEC.md` the answer, and `docs/v1-SPEC.md`'s header says
  so

### Requirement: CLAUDE.md is the short agent guidance

`CLAUDE.md` SHALL be the Appendix B starter: the non-negotiables, the workflow, the commands and the
precedence pointer. §2 states it is "narrower than this file on purpose" — it orients an agent and
points at `docs/SPEC.md`; it does not restate it. [changed]

The full specification text SHALL be removed from `CLAUDE.md` as part of the same change that creates
`docs/SPEC.md`, so the repository is never in a state with two copies.

#### Scenario: CLAUDE.md points rather than restates

- **WHEN** `CLAUDE.md` is read
- **THEN** it names `docs/SPEC.md` as the specification and `docs/v1-SPEC.md` as the v1 reference,
  states the precedence order, and does not contain the specification's numbered sections

#### Scenario: The duplicate is gone

- **WHEN** `CLAUDE.md` is inspected after this change
- **THEN** it no longer carries the full specification text, and its size reflects the Appendix B
  starter rather than the full document

### Requirement: Precedence order is stated where an agent will read it

The §2 precedence order SHALL be stated in `CLAUDE.md`, in `openspec/config.yaml`'s context, and in
`README.md`: code, then `docs/SPEC.md`, then `openspec/specs/`, then `docs/v1-SPEC.md` (only for
`[v1]` items), then design documents.

Every statement of the order SHALL name the same documents at the same paths. A precedence rule that
points at a file which does not exist is worse than none, because it is followed.

#### Scenario: Config points at the real path

- **WHEN** `openspec/config.yaml`'s context is read
- **THEN** it names `docs/SPEC.md`, matching §2 and the file that exists — not "SPEC.md at the repo
  root"

#### Scenario: Every stated path resolves

- **WHEN** each document path named in any statement of the precedence order is resolved against the
  repository
- **THEN** every one exists

#### Scenario: The orders agree

- **WHEN** the precedence order as stated in `CLAUDE.md`, `openspec/config.yaml` and `README.md` are
  compared
- **THEN** all three list the same documents in the same order

### Requirement: Repository documentation describes v2, not v1

`README.md` and `TESTING.md` SHALL describe v2. V1's copies describe the claims platform — its
scenarios, flows, claim workspace and adjudication features — and SHALL NOT be carried as-is.
[changed]

`README.md` SHALL cover the workspace layout, the §42 command set, how to bring the stack up, and
what this bootstrap does and does not deliver. `TESTING.md` SHALL cover the §43 conventions, the
PGlite database-test path, the coverage ratchet rule, and the register of deferred guard tests.

#### Scenario: README describes the v2 layout

- **WHEN** `README.md` is read
- **THEN** it describes the five packages and the `packs/` content root, lists the working commands,
  and states that no schema, authentication or trainee behaviour exists yet

#### Scenario: No carried claims vocabulary in the docs

- **WHEN** `README.md` and `TESTING.md` are read
- **THEN** neither describes claims adjudication, scenarios, flows or the claim workspace as a v2
  feature of this change

#### Scenario: Conventional commit prefixes are documented

- **WHEN** `README.md` is read
- **THEN** it names `develop` as the main branch and lists the §Workflow commit prefixes, including
  `pack` for domain-pack content changes
