Praxis v2 — Generalized Platform Specification

Status: build specification for Praxis v2, drafted 2026-11-16. Section numbers (§) are stable anchors — cite them, don't renumber them.

Relationship to Praxis v1. Praxis v1 is the live claims-adjudication training platform described in its own docs/SPEC.md (referred to here as v1 SPEC). Praxis v2 is a new, generalized healthcare-operations training and certification platform built on the same stack, conventions and proven engines. v1's claims content becomes the first domain pack of v2. Wherever this file says [v1], the behaviour is carried over from v1 and the v1 SPEC section is cited; [new] marks capability v1 does not have; [changed] marks v1 behaviour that v2 deliberately alters.

Praxis v2 takes a trainee from US healthcare literacy → compliant reasoning → verified domain capability → employer readiness, and records every step as audit-grade, versioned evidence.

Non-negotiables
Domain content is configuration, not architecture. Tabs, fields, sections, navigator steps, actions, decision options, result screens, answer keys and reasoning prompts are authored JSON in a domain pack. Adding a domain, tab, field or step is a data change. No domain-specific names (claim, DCN, Pay/Deny) in core logic (§5, §13, §14). [v1 §10–§12, generalized]
No hard-coded certification rules. Pass standards, weights, DRI methodology, thresholds, attempt caps, eligibility counts, renewal periods, durations and progression rules live in the versioned config surfaces of §45. What is deliberately fixed is listed in §45 — do not make those configurable without revisiting the reasoning.
Grading is append-only and snapshotted. Scores, DRI results and credential decisions are written at the moment they happen and never re-derived at read time. Attempt, sitting, DRI, credential, audit and email-log rows are append-only; editing authored content creates a new version (§18, §21, §37). [v1 §16, extended]
Progression, eligibility, scoring, visibility and RBAC are decided server-side. The UI renders what the API returns, including the reason something is locked (§6, §12). [v1 §4]
Answer keys never reach a trainee response. randomization, mismatch, correctValue, expectedValue, expected decisions, reference reasoning, AI-suggestion correctness flags and MCQ correct options are stripped at serialisation (§13, §24). [v1 §10]
AI suggestions are never the trainee's answer. Every suggestion in the workbench needs an explicit verify / accept / modify / reject, recorded with its rationale (§14). [new]
No real PHI. Every pack, seed row and fixture is synthetic.
Every state change to content, scores, config, roster, standards or credentials emits an audit_log row (§37). [v1 §29]
No pricing, billing or payment features.
Workflow

Carried unchanged from v1 (v1 SPEC Workflow, §33–§35).

OpenSpec drives feature work. A change lives in openspec/changes/<id>/ (proposal + specs + tasks), is implemented, then archived. Skills: openspec-propose, openspec-apply-change, openspec-archive-change (§41).
One domain per change. Split cross-domain work.
Add tests for the acceptance criteria you touched (§43). Coverage is a ratchet.
The git hooks are develop's CI. .husky/pre-commit and .husky/pre-push are the gate; never --no-verify onto develop.
If a decision needs governance (§45), implement it as config with a marked default and say so in the PR.
Main branch develop. Conventional commit prefixes: feat, fix, schema, api, ui, store, seed, test, chore, plus pack for domain-pack content changes. [new]
Layout

Same monorepo shape as v1; new modules and the packs/ content root are additions.

apps/web                 React 19 + Vite 7 + Tailwind v4 + shadcn/ui, React Router v7,
                         Zustand, TanStack Form/Table/Query          (dev port 5173)
  src/features/<domain>/  strict MVVM (§39)
  src/app/router.tsx      all routes, role guards, shells
apps/api                 Express 4 + Better Auth + Drizzle           (port 3001)
  src/routes/             route modules, incl. routes/admin/*
  src/services/           business logic — see module list below
packs/                   [new] authored domain packs (§5)
  foundations/            Block 1 content + checkpoint quizzes
  compliance/             Passport content + exam blueprints
  reasoning-generic/      Reasoning Core activities + DRI baseline flow bank
  claims/                 v1's flows, migrated (flows/<code>/ base + v2–v5)
packages/db              Drizzle schema, Pool singleton, ID helpers, seed, drizzle/
packages/shared          Zod schemas + shared constants  (@platform/shared)
packages/ui              shared shadcn components + design tokens   (@workspace/ui)
docker/  ci/jenkins/  ansible/  openspec/  docs/

API service modules: identity, roster, program, content, progression, flow-bundle, workbench, navigator, scoring, normalization, reasoning, dri, assessment, mcq, proctoring, recording-retention, passport, credential, employer, institution, leaderboard, at-risk, reporting, email, audit, sync.

§1 — Purpose and scope

Praxis v2 is a configurable certification engine. Its launch configuration is the Claims Operations track: a 12-week journey of three 4-week blocks plus an optional employer overlay of up to 4 weeks.

In scope: program/track/block authoring; content delivery; checkpoint quizzes; the Compliance Passport; the Reasoning Core; the DRI engine; the domain workbench (v1's Claim Workspace, generalized); training, practice and proctored assessment; credentials and endorsements; cohort, institution and employer management; reporting; the admin console; audit.

Out of scope: pricing, billing, payments, reimbursements; marketplaces; HRIS/ATS integration; automated psychometric validation; automated clinical decision-making; live adjudication against any real payer system.

[changed] v1 listed credentialing as out of scope; in v2 it is core (§27, §28).

§2 — Precedence and sources of truth
The code.
This file (docs/SPEC.md in the v2 repo).
openspec/specs/* in the v2 repo.
The v1 SPEC — authoritative for the behaviour of carried engines ([v1] items) until the corresponding v2 capability spec exists. Where this file marks something [changed], this file wins.
docs/program-design.md — curriculum intent from the program design (4+4+4 structure). Intent, not behaviour.
CLAUDE.md — agent operating guidance; narrower than this file on purpose.
§3 — Vocabulary
Term	Meaning	v1 equivalent
Program	Top-level certification program	— [new]
Track	A domain journey, e.g. Claims Operations	— [new]
Block	A configurable stage of a track (launch: 3 × 4 weeks)	— [new]
Week	A scheduling unit inside a block	— [new]
Module	A teachable topic inside a week; carries SOP documents, videos, activities	Scenario
Sub-module	Optional grouping under a module	Sub-scenario
Activity	Anything a trainee completes: content item, quiz, exercise, flow, reasoning task	— [new]
Flow	One workbench case — the unit a trainee completes and is scored on	Flow
Flow variant	One of ≥5 interchangeable data sets for a flow	Flow variant
Subject	The entity being decided on inside a flow (a claim, in the Claims pack)	Claim
Bundle	The authored JSON files that define a variant (§13)	Bundle
Domain pack	A versioned set of modules, flows, decision vocabulary, glossary and blueprints for one domain	— [new]
Navigator	Ordered teaching steps that carry most of a flow's score	Navigator
Attempt	One graded run of a flow in a mode	Attempt
Sitting	One proctored assessment session	Sitting
Mode	Workspace mode (§16)	Mode
Pool	Whether a variant is eligible for Training / Practice / Assessment	Pool
Reasoning trace	Structured rule → facts → conclusion record attached to a decision	— [new]
DRI	Decision/Reasoning Index — a configurable, versioned measure	— [new]
Compliance Passport	Renewable credential evidencing HIPAA, FWA, security and conduct training	— [new]
Credential	A certification (e.g. Certified — Claims Operations); further tracks add endorsements	— [new]
Overlay	Employer-specific training after certification	— [new]
Institution	Delivery partner linked to cohorts	— [new]
Market	Localization context (e.g. US, IN) for content layers, display time zone and reporting	— [new]

Role naming: v2 keeps v1's trainee / trainer / admin in code and data. "Learner" in design documents means trainee.

Naming collision resolved: the program design uses "scenario" for a workbench case. In v2 code a workbench case is always a Flow; "scenario" is not used as an entity name. v1 scenarios are migrated to modules.

§4 — Program model
§4.1 Hierarchy
programs ── tracks ── blocks ── weeks ── modules ─┬─ content_items (video, document, article, reference)
                                                  ├─ sub_modules ── questions
                                                  ├─ activities (quiz, exercise, reasoning task)
                                                  └─ flows ─┬─ flow_variants (≥5) ── bundle (§13)
                                                            └─ subjects ── subject_variants

Block count, block duration, week count and module placement are configuration on the versioned program_versions / track_versions rows. A module can belong to more than one track (e.g. compliance modules shared across every track).

§4.2 Layer stack
Layer	Purpose	Launch block	Output
Foundations	US health-system literacy; self-selection	Block 1 (wk 1–4)	Completion record, unproctored
Compliance Passport + Reasoning Core	Compliance training with audit-grade evidence, fused with structured-reasoning foundations	Block 2 (wk 5–8)	Passport (2 proctored exams) + DRI baseline
Domain module	Job specialization, one proctored domain exam	Block 3 (wk 9–12) — Claims	Certification (domain score + reasoning score + final DRI)
Employer overlay (optional)	Employer platforms, workflows, terminology, posture	+2 to +4 wks	Employer onboarding record

The engine must also support a pure-compliance Block 2 with reasoning moved into Block 3 (open decision, §45.3).

§4.3 Launch curriculum — Claims track
Wk	Block	Content	Output / assessment	Pack
1	1	US healthcare organization: payers, providers, PBMs, TPAs, brokers, regulators; premium → payer → provider → patient	System map exercise; checkpoint quiz	foundations
2	1	Coverage: commercial, Medicare, MA, Medicaid, exchange; deductible, coinsurance, OOP max, networks	Benefits-explanation exercise	foundations
3	1	Role families: claims, enrollment, UM, RCM; payer vs provider ops; handoffs	Role-family self-assessment	foundations
4	1	Industry pressures; AI and frontline work; the human-in-the-loop role	Block 1 completion; go/no-go	foundations
5	2	HIPAA privacy & security; documentation discipline	Proctored Compliance Exam 1	compliance
6	2	FWA; security awareness (HITRUST CSF-aligned); code of conduct	Proctored Compliance Exam 2 → Passport	compliance
7	2	Reasoning I: rule → facts → conclusion; traces; calibration	First scored reasoning traces	reasoning-generic
8	2	Reasoning II: noise & consistency, inter-rater, base rates, escalation, articulation	DRI baseline sitting	reasoning-generic
9	3	Claim lifecycle; CPT / ICD-10 / HCPCS; EOB anatomy	Workbench flow set wk 9	claims
10	3	Adjudication logic, denials, COB, timely filing, adjustments; platform concepts	Workbench flow set wk 10	claims
11	3	AI-assisted adjudication: verify copilot output, catch plausible-but-wrong decisions	Adversarial verification flows	claims
12	3	Integration: manual, AI-assisted and exception flows	Proctored domain exam	claims

Mapping v1 content into Block 3: v1's 93 flows are migrated into the claims pack and assigned to weeks 9–12 by an authored mapping in the pack manifest. Weeks 9–10 draw on v1 flows directly; weeks 11–12 need new AI-assisted and integration flows (§14.3).

§5 — Domain packs [new]

A domain pack is the unit of domain configuration. Core code knows packs only through their manifest.

packs/<pack-id>/
  pack.json              id, version, title, domain, decision vocabulary, reason-code
                         vocabulary, glossary ref, module→week mapping, exam blueprints
  glossary.md            domain terms (claims: PX edits, SPS, Non-PAR, PCM ticket, write-off codes)
  modules/<module-id>/   module metadata, content item refs, quizzes
  flows/<code>/          base bundle + v2–v5 variant folders (§13)
Decision vocabulary is authored per pack [changed]. v1's claim_decision_type enum (Pay | Deny) becomes the Claims pack's decisionOptions: ["pay", "deny"]. The core stores the submitted decision as a validated string key. "No decision" remains a first-class correct answer stored as NULL [v1 §1]; code that treats null as "didn't answer" is wrong.
Reason codes are likewise pack-authored vocabularies.
Pack versions are immutable once a cohort is enrolled against them. Edits publish a new pack version; existing enrollments keep theirs unless migrated (audited).
Pack sync (§44) reconciles packs/ with a running stack, replacing v1's flow-only sync.

Future packs the engine must support without core changes: Membership & Enrollment Ops, Broker & Group Ops, UM/CM/DM Support Ops, Provider Data & Credentialing Ops, RCM Front-End, RCM Back-End, Risk Adjustment Evidence & Documentation Ops (6–8 weeks, clinical-vocabulary prerequisite), Patient Access & Throughput. Implied requirements: variable block duration, module-level prerequisites outside the standard stack, several credentials per trainee (endorsements), pack-specific flows, rubrics and DRI mappings on shared engines.

§6 — Roles and RBAC

user_role = admin | governance_admin [new] | trainer | evaluator [new] | trainee | employer_viewer [new, phase 2] | institution_viewer [new, phase 2].

admin — as v1 [v1 §4]: cohorts, roster, authoring and the bundle studio, packs, MCQ bank, platform settings, audit and request logs, email templates, users and impersonation. Cannot change pass standards, DRI methodology or credential requirements, and cannot issue or revoke credentials.
governance_admin — pass standards, DRI methodology versions, credential requirement sets, credential issuance/suspension/revocation, Passport renewal policy. Every action is audited with a required reason.
trainer — as v1: assigned cohorts, leaderboard, reports, assessment configuration and results, MCQ, teaching runs. Plus: reasoning review for assigned cohorts.
evaluator — manual scoring of reasoning traces and manually reviewed sitting items, scoped to assigned cohorts. No configuration rights.
trainee — home, program view, workbench, practice, assigned assessments, results, credentials, guides.
employer_viewer / institution_viewer — read-only, scoped to their employer's or institution's cohorts; never raw evidence or recordings.

Enforcement as v1: requireAuth, then requireRole([...]) in auth.middleware.ts; the broad /api/admin router applies requireRole(["admin"]) at router level; governance routes live under /api/governance with requireRole(["governance_admin"]). A hidden menu item is not access control. Trainers and evaluators are scoped through cohort_trainers / cohort_evaluators.

§7 — Identity, authentication and sessions [v1 §5]

Carried unchanged: Better Auth email-OTP only; users as the single identity table; 2-hour rolling sessions with /api/session/keepalive; one active session per trainee with the "used inside the active window" rule; tab lock; tab-close session end; OTP lockout; mobile block.

[changed] Display time zone is per cohort (derived from its market, overridable on the cohort), not fixed to Asia/Kolkata. packages/shared/src/format/ gains a zone-aware formatter; IST stays the default for IN-market cohorts.

§8 — Admin users and impersonation [v1 §6]

Carried unchanged: read-only "view as", IMPERSONATION_READ_ONLY, 3600-second cap, reason 5–200 characters, start and end audited. Governance admins cannot be impersonated into a write-capable state (impersonation is always read-only).

§9 — Cohorts, roster, working days and attendance

Carried [v1 §7]: cohort_status draft → active → completed; mode_of_training; cohort_trainers; derived working days with cohort_working_day_overrides; attendance statuses and attendance %; transfers with reasons.

Added [new]:

A cohort is enrolled against one track version and one pack version set.
cohorts.market_id, optional employer_id, optional institution_id, is_control (flag for later external-outcome comparison).
cohort_evaluators junction.
cohort_start_date plus the track's block/week calendar drive week availability (§12). Week dates are computed from working days, so holidays push the calendar.
§10 — Content catalogue and program builder
Content items [new] are versioned (content_items + content_item_versions): type (video | document | article | reference | quiz | exercise), market/localization tag, required/optional, publish status, effective/expiry dates, author, reviewer, prerequisites. Media lives in object storage (S3_PUBLIC_BUCKET for trainee media, as v1).
Completion of a content item is recorded per trainee (trainee_content_progress) and feeds progression (§12). Viewing alone never issues a credential (§27).
Checkpoint quizzes reuse the MCQ engine (§24) in an unproctored, unlimited-attempt configuration.
Localization layers [new]: content tagged to a market is required/optional per cohort. Localization cannot alter proctored assessments, pass standards, the DRI flow bank or DRI methodology. One exam bank per pack across all markets and institutions.
Admin authoring: v1's scenario tree editor becomes the program builder (program → track → block → week → module). v1's per-flow bundle studio is carried (/admin/modules/:id/studio/:flowId). Deep-copy clone in one transaction is carried [v1 §8].
§11 — Content audience and visibility [v1 §9]

Carried unchanged: the coarse content_visibility_settings row, and the content_audience ladder (everyone → admins_and_trainers → admins_only) with per-row hidden_for_trainer / hidden_for_trainee. Applies to modules, flows and content items. Visibility is independent of progression: a visible item can still be locked (§12).

§12 — Progression engine [new, absorbs v1 §17]

One service, progression.service.ts, answers "can this trainee open this, and if not, why" for every block, week, module, activity, flow mode and assessment. Every consumer — routes, sitting endpoints, the program view — asks it; nothing re-implements a gate.

Rule sets. progression_rule_sets are versioned. A trainee is evaluated against the rule set version of their enrollment unless an admin migrates them (audited).

Launch gates (configurable):

Gate	Rule	Unlocks
Week availability	Calendar date reached for the cohort (§9)	Week content
Block 1	All mandatory wk 1–4 activities complete + go/no-go recorded	Block 2
Passport	Compliance content complete + both compliance exams passed	Passport issuance (§27)
Week 8	Reasoning activities complete + DRI baseline sitting completed	Block 3
Block 3	Required domain flows complete + domain exam passed + final DRI recorded	Certification eligibility (§28)
Overlay	Employer requirements complete	Employer onboarding record

Carried flow-level gates [v1 §17]:

Practice unlock: isPracticeUnlocked = completed || !trainingEligible, where completed = a flawless Training run. Refusal code practice_locked.
Assessment eligibility: assessment_eligibility_settings, default N = 3 perfect Training and Practice runs per examined flow, with v1's "nobody is asked for more than they are allowed" rules. Applies to workbench-phase flows of domain sittings only; it does not apply to compliance exams or the DRI baseline (those gate on content completion).
Flow mode eligibility derives from variant pool flags.

Lock reasons. Every refusal returns { code, reason, unlockHint }, e.g. { code: "block_locked", reason: "Complete Week 4 before starting Week 5." }. The web app renders reason verbatim.

§13 — Flow bundles [v1 §10, extended]

A flow variant is a bundle in object storage under bundle_object_prefix.

File	Owns	Status
ui.json	Tabs, sub-tabs, sections, fields, action menus	[v1]
data.json	Subject data + reserved randomization / mismatch blocks	[v1]
navigator.json	Ordered steps, triggers, points, highlights	[v1]
state.json	Action definitions and their writes	[v1]
result.json	Rubric + result-screen config	[v1, rubric extended §18]
reasoning.json	Optional. Trace fields to capture, prompts, reference reasoning, rubric criteria	[new]
assist.json	Optional. AI-suggestion content per decision point + correctness flags	[new]

Pipeline as v1: resolveBundleSource(subject) → cache → assembleFlowBundle() → WorkspaceSchema. Reference reasoning and assist.json correctness flags are stripped for trainees exactly like correctValue.

[changed] Defects not carried into v2:

One navigator per flow, by construction. v1 serves the base navigator.json to every variant, leaving ignored v2–v5 copies. v2's bundle loader rejects a variant folder that contains navigator.json; the migration deletes the stale copies.
Field-level visibleWhen — v1 silently ignores it. v2's schema rejects it at load time (only section-level, single strict-equality visibleWhen, as v1).
Variant provider identity — the v1 → v2 migration validates graded values against each variant's own data and fails flows whose variants contradict themselves.
§14 — Workbench [v1 §11, generalized]

v1's Claim Workspace becomes the domain-agnostic workbench. Everything is rendered from ui.json with v1's tab renderTypes and 36 field types.

§14.1 Carried rules

Section-level visibleWhen only; badge is the only red display; reject-code pickers offer at least MIN_REJECT_CODE_OPTIONS = 5.

§14.2 Bespoke sub-tabs [changed]

v1's bespoke sub-tabs that hardcode data paths bypass ui.json. In v2 a bespoke component is allowed only if it is registered in workbench/components/registry.ts with a declared dataPath contract the bundle schema validates. Unregistered bespoke components fail the pack test sweep.

§14.3 AI-assisted mode [new]

Enabled per flow by assist.json.

At each declared decision point the workbench shows an AI suggestion panel with the authored suggestion (decision, reason code, rationale text).
The trainee must record verify → then accept | modify | reject, with a rationale of at least the configured minimum length. Submission is refused (AI_SUGGESTION_UNRESOLVED) while any suggestion is unresolved.
The suggestion is never copied into the trainee's decision fields. accept means the trainee enters the same value themselves.
Adversarial flows author plausible-but-wrong suggestions; whether the trainee caught them is scored (§18).
MVP suggestions are pre-authored content (reproducible). Live model output, if ever added, must be versioned, logged and treated as untrusted content.
§14.4 Reasoning capture [new]

When reasoning.json is present the workbench shows a structured trace panel (applicable rule, relevant facts, conclusion, confidence, escalation required, final response — fields configurable per flow). Traces are stored in reasoning_traces and linked to the attempt.

§14.5 Escalation [new]

Packs may author an escalate decision option. Correct escalation is a scorable outcome, like v1's correct "no decision".

§15 — Navigator [v1 §12]

Carried unchanged: the nine completion triggers with COMPLETION_TRIGGERS as single source of truth; per-step fields; *_after_activation rule; expectedTokens normalisation shared by schema validation and grading; insert-first rule; points vs weights.navigator cap.

New trigger for v2 [new]: reasoning_submitted and ai_suggestion_resolved. Both are added to COMPLETION_TRIGGERS and the navigator store together; the parity test (§43) enforces it.

stepSummaryForResults is either rendered on the result screen or removed from the schema — not left as dead authored content.

§16 — Workspace modes [v1 §13, changed]

WorkspaceMode values in v2:

Mode	Navigator	Hints / highlighting	AI panel	Attempt cap	Scored
training	visible	yes	if flow has assist.json	enforced	yes
practice	hidden	yes	if flow has assist.json	unlimited by design	yes, excluded from score aggregates
assessment	hidden	no	per sitting config	one sitting	yes
embedded	hidden	no	no	—	no
demo	hidden	no	yes	—	no
assignment mode is not carried. Its legacy twin enum training_mode is not carried either; v2 has one mode enum, flow_attempt_mode (training | practice | assessment). The v1 → v2 migration renames the assignment key inside every variant's state.json.
showNavigator, useHighlightFields, isUnscoredRun() and ProctoredShell placement behave as v1.
Practice and Assessment show no Navigator, so the subject description remains the only task statement in those modes — authors must write it.
§17 — Attempts and caps [v1 §14]

Carried: one trainee_attempts row per run with child rows (attempt_step_results, attempt_tab_visits, attempt_field_interactions, attempt_question_answers); the trainee_flows rollup; effective Training cap = subject max_attempts ?? flow max_attempts, plus bonus_attempts; flow completion = flawless run; server-authoritative clock anchor (CLOCK_ANCHOR_INVALID).

Added [new] child rows: attempt_reasoning_traces, attempt_ai_resolutions (suggestion id, verify timestamp, resolution, rationale, was-suggestion-correct snapshot).

proxy_violations is not carried (it belonged to legacy assignment mode).

§18 — Scoring: the rubric [v1 §15, extended]

rubric-scoring.ts stays the single source of truth; the client displays what the server returns. v1's three components are kept with identical formulas; v2 adds optional components that score zero weight unless the flow's rubric declares them.

navigatorScore  = v1 formula (in-order credit, cap at weights.navigator, missed-required deduction, clamp 0)
decisionScore   = v1 formula, comparing pack decision keys; NULL == NULL is a match
reasonScore     = v1 formula
reasoningScore  = clamp( Σ criterionPoints from reasoning evaluation, 0, weights.reasoning )     [new]
assistScore     = clamp( Σ per-suggestion points − deductions.acceptedWrongSuggestion × n, 0,
                         weights.assist )                                                        [new]
escalationScore = expectedEscalation === submittedEscalation ? weights.escalation
                  : clamp(0 − deductions.wrongEscalation, 0)                                     [new]
totalScore      = Σ components
Credit stops at the first missed navigator step [v1].
scorePoints is the step's weight; do not rescale [v1].
Each component clamps at 0 [v1].
Reasoning evaluation can be auto (criteria matched against reference tokens with the shared normaliser), manual (evaluator scores criteria) or hybrid. While a manual component is pending the attempt carries evaluation_status = pending_review and its normalized score is not yet written; once evaluated, the final snapshot is written once and is append-only. (Open decision §45.3: manual vs automated reasoning evaluation.)
result.json's resultConfig drives the result screen [v1].
Legacy non-bundle claims are not carried; every v2 flow is a bundle.
§19 — Normalization and pass standards [v1 §16, changed]

Carried: score-normalization.ts; rubricMaxPoints = Σ declared component weights; normalizedScore = clamp(round(total / max × 100), 0, 100); per-component percentages; snapshot at submit, never derive at read time; only normalized 0–100 values reach leaderboard, at-risk, progress or reports.

[changed] Pass standards. v1 fixes FLOW_PASS_MARK_PCT = 70 for every flow. v2 keeps 70 as the default flow pass mark but moves pass standards into the governance-owned, versioned pass_standards table:

scope: flow | assessment | credential_requirement
value_pct, version, effective_from, approved_by (governance_admin), reason
An attempt or sitting snapshots the pass_standard_version it was judged against.

rubric.passMark in result.json remains ignored by the scorer, as v1. This is open decision §45.3 ("certification pass criteria"); until governance sets values, defaults reproduce v1 (70 for flows, the trainer-entered mark for assessments).

§20 — Reasoning Core [new]

Model: Rule → Facts → Conclusion.

Reasoning activities are flows in the reasoning-generic pack: short, domain-neutral cases with reasoning.json, usually a small ui.json and no navigator weight.
Trace fields (configurable per flow): scenario, applicable rule, relevant facts, decision, explanation, confidence (0–100), escalation required, final response.
Calibration records learner decision, expected decision, difference, confidence, feedback, score. Calibration error is a DRI input.
Consistency / noise exercises: the same case (or an isomorphic variant, using the ≥5 variant mechanism) presented more than once, or the same case evaluated by several trainees in a cohort (inter-rater). Agreement is computed per case and per trainee and stored in consistency_measurements.
Reasoning activity results in Training and Practice follow v1's practice-exclusion rule for aggregates; only sittings feed DRI.
§21 — DRI engine [new]

No formula is defined. Do not hard-code one.

dri_methodologies (versioned, governance-owned) declares components. Each component has an input source — reasoning_criteria, calibration_error, consistency_agreement, escalation_accuracy, assist_detection, decision_accuracy — a weight, a scale, and an aggregation strategy key resolved from a registry in dri/strategies/.
dri-calculation.job.ts runs after a DRI-bearing sitting completes (or after its pending reviews are evaluated) and writes one immutable dri_results row plus dri_component_scores.
Each dri_results row stores: methodology version, rubric versions, flow variant versions, pack version, sitting id, calculation time, source (system | evaluator), kind (baseline | final | renewal).
Measurement points (launch): baseline = Week 8 DRI baseline sitting on the reasoning-generic flow bank; final = Week 12 domain exam.
Comparison: Baseline → Final → Change is computed only between results of the same methodology version. If versions differ, the report shows both and flags the mismatch.
A new methodology version can be recomputed side by side from stored inputs into dri_results rows with kind = recompute; the original rows are never replaced.
Trainees see their DRI value and change; the formula is not exposed unless governance enables dri_settings.showFormulaToTrainees.
§22 — Assessments (authoring) [v1 §18, extended]

Carried: assessment_status draft → active → completed; trainer composition; all junction rows in one transaction; retest; showResultsImmediately.

[new] Assessment kinds (assessment_kind):

Kind	Proctored	Sections	Feeds
checkpoint_quiz	no	MCQ	Block progression
compliance_exam	yes	MCQ (+ optional workbench)	Passport (§27)
dri_baseline	configurable	reasoning flows	DRI baseline
domain_exam	yes	MCQ + workbench + reasoning	Domain score, reasoning score, final DRI, certification
overlay_assessment	configurable	any	Employer onboarding record
Blueprints. Compliance exams and domain exams are composed from a pack's exam blueprint (sections, item counts per tag/difficulty, flows by pool) rather than hand-picked per cohort, so every market and institution sits the same standard. Trainers choose cohort, trainees and window; they cannot alter a blueprint-bound assessment's content or pass standard.
checkpoint_quiz keeps trainer/admin hand composition.
Assessment versions: the composed item set is frozen on activation (assessment_versions).
§23 — Assessment sittings [v1 §19, generalized]

Carried: one trainee_assessment_sessions row per sitting; statuses; route arc (intro → device check → sections → results); planned-work denominators so early /complete cannot shrink the max; no time-weighting; half-up rounding at storage; clamp to [0, 100]; early exit reasons with "an exited sitting is still completed"; window-close job; held results and assessment-result-release.service.ts.

[changed] Phases become ordered sections. v1's fixed mcq → claim phases become an ordered list of sections from the assessment version: mcq, workbench, reasoning. assessment_session_phase stores the current section index and kind.

sectionPoints[s] = Σ earned points of rows in section s
sectionMax[s]    = planned max of section s (v1 rule: unattempted planned items still count)
domainScore      = normalized over sections tagged `domain`
reasoningScore   = normalized over reasoning components (rubric reasoningScore + reasoning sections)
totalScore       = section-weighted normalized total, weights from the assessment version
passed           = totalScore >= snapshotted pass standard

A domain_exam result always exposes domain score, reasoning score and DRI separately. Sittings with pending manual review stay completed with evaluation_status = pending_review; results release after evaluation.

§24 — MCQ bank [v1 §20]

Carried: categories, questions, tags, difficulty, four options A–D, explanation; MCQ_POINTS_PER_QUESTION = 10; correct answers and explanations stripped for trainees; bulk operations; delete guards.

[new] Questions are versioned (mcq_question_versions); a sitting answer references the version shown. Questions carry pack_id, module_id, tags and proctored_only so blueprints can draw from them.

§25 — Proctoring and recordings [v1 §21]

Carried unchanged: ProctoredShell and the trainee-assessment/proctoring/ folder; proctoring_settings; capture defaults and bounds with fall-back-to-default validation; recording_status lifecycle including load-bearing processing; violation vocabulary and violation_severity; network readiness endpoints.

v1's in-house proctoring is v2's proctoring provider for launch. The program design's open decision on a proctoring provider (§45.3) becomes "whether to add an external provider"; if added, it plugs in behind a proctoring-provider adapter interface with the in-house implementation as the default.

[new] Passport and certification evidence packages (§27, §28) reference sitting recordings by id; they never copy media.

§26 — Recording retention and archive [v1 §22]

Carried unchanged: recording_retention_settings, purge triggers, terminal purged, archived to Azure Blob.

[new] Evidence hold: a recording referenced by an issued credential's evidence package is held until evidence_retention_settings.credentialEvidenceDays after the credential's expiry, even if the general retention window has passed. Default and policy are open decision §45.3 (data retention periods).

§27 — Compliance Passport [new]
compliance_passports (one per trainee), passport_requirements (versioned requirement set: required content items + required compliance_exam passes), passport_renewals.
States: not_started → in_progress → assessment_pending → passed → issued → (renewal_required | expired | suspended).
passport.service.ts evaluates the requirement set on every relevant event (content completion, sitting completion). When all pass, it moves to passed and enqueues credential-issuance.job.ts, which issues, numbers and emails.
Never issued for content viewing alone.
Evidence package (immutable, created at issue): sitting ids, scores, pass-standard versions, timestamps, recording ids, content item versions completed, requirement-set version.
Transcript export: PDF + JSON, format configurable (open decision §45.3).
Renewal: passport_settings.renewalMonths (default 12, flagged), renewal assessment blueprint, reminder schedule; renewal history rows.
Copy must say "HITRUST CSF-aligned security awareness"; never imply individual HITRUST certification. A test asserts the phrase on the Passport template.
§28 — Credentials and certification [new]

Four separate facts, never one boolean: learning completion (progress rows), assessment result (sittings), credential (credentials), employer readiness (employer_onboarding_records).

credential_types (e.g. claims_operations), credential_requirement_sets (versioned, governance-owned), credentials, credential_endorsements, credential_status_history.
States: not_eligible → in_progress → eligible → pending_review → certified → (expired | suspended | revoked).
Launch requirement chain (configurable): Block 1 complete → Passport issued → Reasoning Core complete → DRI baseline recorded → Claims block complete → domain exam passed → final DRI recorded → certification.
Grammar: Foundations + Passport + one domain = certification ("Certified — Claims Operations"); each further track completed adds an endorsement to the same holder. Optional program certificate for a configured subset of blocks (e.g. Blocks 1–2).
pending_review exists so governance can require a human sign-off before issuance (credential_types.requiresReview, default false).
Suspend and revoke are governance_admin only, require a reason, are audited and emailed.
Credential numbers come from new ID helpers (§40); never constructed by hand.
Verification (phase 2): GET /api/public/credentials/:number returns holder name, credential type, status and dates only.
§29 — Employer overlay [new, phase 2]

employers, employer_overlays (employer, track, duration, modules, assessments, completion rules, delivery model pre_hire | post_hire), overlay_enrollments, employer_onboarding_records. Overlay modules are ordinary modules in an employer-scoped pack; their flows use the same workbench and scoring.

§30 — Institutions and markets [new]
institutions: name, market, co-branding metadata (logo object key, certificate label rules). Linked to cohorts. Institutions cannot modify assessments or pass standards.
markets: code (US, IN), default display time zone, localization layer ids.
Institution users get institution_viewer (phase 2).
§31 — Leaderboard [v1 §23]

Carried unchanged: leaderboard_weights_v2, the attendance / practice / assessment formula, sum-to-100 validation, PRACTICE_QUALIFYING_SCORE_PCT = 100, ranking order. Scoped per cohort. Whether DRI or reasoning score should become a leaderboard term is not decided — adding one requires a new config key (_v3) for the same reason _v2 exists.

§32 — At-risk model [v1 §24]

Carried unchanged: weighted parameters, bands, AT_RISK_DEFAULTS, trailing-failure-streak windows, the invariant that every weight stays >= bandMediumMin, and the list of removed parameters that must not be reintroduced without revisiting why.

Candidate new parameters (not built until governance asks): dri_baseline_low, block_gate_stalled. Each must respect the weight ≥ band invariant.

§33 — Trainee progress, home and program view

Carried [v1 §25]: per-flow Training/Practice counts with perfect-run counts; graded vs practice aggregates; home with assigned content, assessments, daily_tips, guides.

[new] Program view answers: Where am I? What's left? Why is it locked? What's next? What have I achieved? It shows blocks and weeks with lock reasons from §12, Passport status, DRI baseline / latest / change, credential status and overlay status.

Trainee nav: Home · My Program · Current Week · Workbench · Practice · Assessments · Results · Credentials · Overlay · Guides · Profile.

Randomization: v1's randomization is dormant [v1 §25]. v2 either wires resolveBundleData into Practice and Assessment delivery or removes the randomization block from the schema — decided in the workbench OpenSpec change, not left dormant.

§34 — Reports [v1 §26, extended]

Carried: SheetJS exports recorded in report_exports; report columns reuse the app's own scoring functions — no report-only rules; export conventions; trainer cohort scoping; explicit ordering; scheduled trainer report.

[new] report_type additions: block_progress, passport_status, dri_comparison, certification_status, institution_outcomes, employer_candidates (phase 2). Program reporting segments by cohort, market, institution and employer, and counts Block 1 go/no-go exits separately from failures.

external_outcomes (trainee, metric, value, source, date) supports later import of externally measured outcomes against is_control cohorts (phase 2).

§35 — Teaching runs, sandbox, guides and tips [v1 §27]

Carried unchanged; available for every pack.

§36 — Email and notifications [v1 §28]

Carried: code-owned email_template_key; adding a key is a migration; admins edit copy; code-owned branded shell; sent / failed / skipped / suppressed; log retention.

[new] keys (one migration): block_available, week_available, passport_issued, passport_renewal_reminder, passport_expired, certification_issued, certification_status_changed, credential_expiry_reminder, reasoning_review_completed, overlay_assigned (phase 2), overlay_completed (phase 2).

§37 — Audit log, request log, append-only doctrine [v1 §29]

Carried unchanged: immutable audit_log (uuidv7() key, before/after JSONB, ip, user agent), api_request_log with retention.

Append-only also covers [new]: reasoning_traces, attempt_ai_resolutions, consistency_measurements, dri_results, dri_component_scores, credential_status_history, passport_renewals, evidence packages, and every versioned config row (pass_standards, dri_methodologies, progression_rule_sets, credential_requirement_sets, passport_requirements).

Must-audit additions: pass standard set; DRI methodology published; requirement set published; Passport issued / suspended / renewed; credential issued / suspended / revoked; manual evaluation submitted or overridden; trainee migrated between rule or pack versions; pack version published.

§38 — API conventions [v1 §30]

Carried unchanged: Express 4 with express-async-errors first; { error, details?, code? } with ZodError → 422; admin sub-router registration order; middleware order; open endpoints; pagination constants; Redis response cache; Zod schema first; Drizzle query builder only, no any; shared error codes in packages/shared.

[new] routers: /api/program, /api/progression, /api/reasoning, /api/dri, /api/passport, /api/credentials, /api/governance/*, /api/admin/packs, /api/admin/institutions, /api/admin/employers, /api/public/credentials (phase 2).

[new] shared error codes: block_locked, week_locked, module_locked, AI_SUGGESTION_UNRESOLVED, REASONING_INCOMPLETE, GOVERNANCE_REASON_REQUIRED, PACK_VERSION_MISMATCH, EVALUATION_PENDING.

§39 — Web conventions [v1 §31]

Carried unchanged: strict MVVM (model/ schema + store → viewmodel/ hooks → view/); views never call api.*; all access through lib/api.ts; shadcn/ui only; Sonner toasts; mandatory loading and error states; design tokens locked to the shadcn preset b1aJCZWLY; routes in app/router.tsx.

[new] feature folders: program, progression, reasoning, ai-assist, dri, passport, credentials, governance, packs, institutions, employers, overlay.

§40 — Data model

packages/db/src/schema.ts, Drizzle, snake_case tables, Postgres enums. Use the v1 table designs where marked carried; the v2 migration set starts fresh (0000_init) and a separate v1 import job (§46) moves v1 data.

Carried groups [v1 §32]: auth · roster · progress (minus proxy_violations) · assessment · MCQ · operations (attendance, leaderboard_entries, trainer_notes, daily_tips, guides, report_exports, audit_log, api_request_log, app_config, email_templates, email_log, sync_state).

Renamed: scenarios → modules, sub_scenarios → sub_modules, sub_scenario_questions → sub_module_questions, claims → subjects, claim_variants → subject_variants, claim_links → subject_links, flow_claim_questions → flow_questions, cohort_scenarios → cohort_modules, trainee_scenario_unlocks → trainee_module_unlocks, trainee_assessment_claim_attempts → trainee_assessment_flow_attempts.

Dropped: workspace_schemas, navigator_schemas, navigator_steps (bundles own these), flows.eligible* cache columns, training_mode enum, proxy_violations, claim_decision_type enum.

New groups:

program: programs, program_versions, tracks, track_versions, blocks, weeks, track_modules, content_items, content_item_versions, trainee_content_progress, activities
packs: packs, pack_versions, cohort_pack_versions
org: markets, institutions, employers, cohort_evaluators
progression: progression_rule_sets, trainee_gate_events
reasoning: reasoning_traces, attempt_ai_resolutions, consistency_measurements, reasoning_evaluations
DRI: dri_methodologies, dri_results, dri_component_scores
standards: pass_standards, assessment_versions, mcq_question_versions
credentials: compliance_passports, passport_requirements, passport_renewals, credential_types, credential_requirement_sets, credentials, credential_endorsements, credential_status_history, evidence_packages
overlay (phase 2): employer_overlays, overlay_enrollments, employer_onboarding_records
outcomes (phase 2): external_outcomes

IDs — always use helpers in @platform/db ids.ts backed by raw sequences (ensureIdSequences()):

Helper	Format	Status
formatTraineeId	HYTE-#####	[v1]
formatTrainerId	CRTR-#####	[v1]
formatSubjectRef	pack-defined prefix; Claims pack keeps DCN-######	[changed from formatDcn]
formatPassportNumber	PSPT-######	[new, proposed — confirm §45.3]
formatCredentialNumber	CERT-######	[new, proposed — confirm §45.3]

New enums: assessment_kind, passport_status, credential_status, dri_result_kind, evaluation_status, evaluation_mode, ai_resolution, gate_kind, delivery_model.

§41 — Build phases

Work runs through OpenSpec exactly as v1 [v1 §33]: propose → apply → archive, one domain per change, tasks ~2 hours with Depends on:. The roadmap below orders the changes; each row becomes one or more OpenSpec changes.

Phase	Changes
A — Foundation	Repo bootstrap from v1 skeleton (stack, CI, hooks, docker, ansible); auth/sessions/impersonation port; roster port + markets/institutions; program hierarchy + versions; packs + pack sync; audit + request log port
B — Learning	Content items + completion; checkpoint quizzes on MCQ engine; progression engine + lock reasons; program view and home
C — Workbench port	Bundle loader with v2 schema guards; workbench + navigator port; modes; attempts; rubric scoring + normalization port; v1 claims import (§46)
D — Assessment	Assessment kinds + versions + blueprints; sections-based sittings; MCQ versions; proctoring + recordings port; held results
E — Reasoning & DRI	reasoning.json + trace capture; evaluator workflow; calibration + consistency; DRI methodology + calculation job; baseline/final comparison; reasoning-generic pack content
F — AI-assisted mode	assist.json; suggestion panel + resolution; assist scoring; weeks 11–12 flows
G — Credentials	Pass standards; Passport + renewal; credential types, requirement sets, issuance job, endorsements, program certificate; evidence packages; transcript
H — Operations	Trainer + evaluator dashboards; governance console; leaderboard + at-risk port; reports + new report types; email keys
I — Phase 2	Employer overlay; employer + institution viewers; credential verification; external outcomes; external proctoring adapter

Audit (A) and the progression engine (B) come before any feature that needs them.

§42 — Environments, configuration and deployment [v1 §34]

Carried unchanged: Docker / Swarm deploy path and VSCode tasks; layered committed env files (base.env → <env>.env → optional .env, later wins); images on Bun (oven/bun:1.4-alpine) with every container job through praxis-task; host dev on Node ≥ 20

pnpm@11.5.0; Jenkins pipelines with shell scripts in ci/jenkins/scripts/; PRAXIS_DEPLOY_ENABLED dry-run gate; Bitbucket Cloud + Azure Container Registry; PR previews gated by PRAXIS_PREVIEWS_ENABLED; Ansible provisioning.

[new] v2 runs as a separate stack (own database, buckets and Redis prefix) during migration; image names praxis2-api, praxis2-web (confirm). New bucket S3_PACKS_BUCKET replaces S3_FLOWS_BUCKET.

Commands are v1's: pnpm dev | build | lint | typecheck | test | test:db | format:check | db:push | db:seed | db:migrate | db:studio, plus pnpm packs:validate and pnpm packs:sync [new].

§43 — Testing and acceptance [v1 §35]

Carried conventions: no live DB in unit tests (vi.mock("@platform/db"), PGlite for test:db); no network in web tests (mock lib/api.ts); deterministic, always-restored fake timers; coverage ratchet; parallel suites; it.fails / it.skip + // BUG: for genuine bugs; Playwright e2e.

Carried guard tests, generalized: pack sweep against allow-lists (now packs/**); COMPLETION_TRIGGERS parity.

[new] guard tests:

Answer-key leak test: every trainee-role serializer is fed a bundle containing every reserved key and must emit none of them.
No-domain-names test: core service folders must not contain pack vocabulary (claim, dcn, pay, deny) outside allow-listed adapters.
Snapshot immutability test: editing a rubric, pass standard or DRI methodology after submit leaves existing attempt, sitting and DRI rows unchanged.
AI auto-accept test: no code path copies an assist.json value into a submission.
HITRUST wording test on Passport templates.

End-to-end acceptance (MVP trainee):

Sign in with OTP.
Join a Claims cohort (market and institution set).
See the 12-week program with locks and reasons.
Complete Week 1.
Complete Block 1 and record go/no-go.
Enter Block 2.
Complete HIPAA content.
Sit Compliance Exam 1.
Complete FWA/security content.
Sit Compliance Exam 2.
Receive the Passport when requirements are met.
Complete Reasoning I.
Complete Reasoning II.
Sit the DRI baseline.
Enter Block 3.
Complete workbench flows in Training, then Practice.
Complete AI-assisted flows, resolving every suggestion.
Complete integration flows.
Sit the proctored domain exam.
See domain score, reasoning score and DRI with baseline comparison.
Become certification-eligible when all rules pass.
Receive the Claims credential.
View credential and Passport history.
Every major action appears in audit_log.

Each change's own acceptance criteria live in its OpenSpec proposal.

§44 — Observability and scheduled work [v1 §36]

Carried: /api/health, /api/public-config, Sentry, internal cron endpoints (trainer-reports, request-log-purge), assessment-window-close.job.ts, recording-retention.job.ts, sync service, load testing.

[new] jobs: dri-calculation.job.ts, credential-issuance.job.ts, credential-expiry.job.ts (expiry + reminders), passport-renewal-reminder.job.ts, week-availability.job.ts (emails). Sync gains pack-sync (replaces bundle-sync).

§45 — Governance decisions
§45.1 Configurable with marked defaults
Decision	Surface	Default
Leaderboard weights	leaderboard_weights_v2	10 / 30 / 60 [v1]
Proctoring switches + capture	proctoring_settings	all on; 960×540 @15, 800+64 kbps [v1]
Assessment eligibility N	assessment_eligibility_settings	3 [v1]; domain-exam workbench flows only
Content visibility	content_visibility_settings	both on [v1]
Recording retention	recording_retention_settings	off; 90 days [v1]
At-risk	at_risk_*	70 / 8 / 3 / 35 / 40 / 34 / 67 [v1]
Trainer report	trainer_report_settings	off; biweekly [v1]
Rubric weights	variant result.json	authored per flow [v1]
Attempt caps	subject/flow max_attempts + bonus	authored [v1]
Content audience	content_audience	everyone [v1]
Working-day calendar	cohort_working_day_overrides	login majority [v1]
Pass standards	pass_standards	flows 70; assessments trainer-entered → blueprint value [new]
Progression rules	progression_rule_sets	launch gates §12 [new]
DRI methodology	dri_methodologies	placeholder v0 (equal-weight components), flagged "not approved" [new]
DRI formula visibility	dri_settings	hidden [new]
Passport requirements	passport_requirements	HIPAA + FWA/security content + 2 exams [new]
Passport renewal	passport_settings	12 months, flagged [new]
Credential requirements	credential_requirement_sets	launch chain §28 [new]
Credential review step	credential_types.requiresReview	false [new]
Evidence retention	evidence_retention_settings	flagged, no default approved [new]
Reasoning evaluation mode	flow reasoning.json	manual [new]
AI rationale minimum	assist_settings.minRationaleChars	20 [new]
Block durations	track_versions	4 / 4 / 4 (+ up to 4) [new]
Display time zone	markets / cohort	US: America/New_York; IN: Asia/Kolkata [new]

The admin and governance consoles show a "not approved" badge on any value still at a flagged default.

§45.2 Deliberately not configurable

Carried from v1: MCQ_POINTS_PER_QUESTION = 10; the 100% bar for flow completion, Practice unlock, the leaderboard practice term and assessment eligibility; no time-weighting; credit stops at the first missed navigator step; email template keys code-owned; the branded email shell; content_audience as a ladder; audit-log immutability.

New: AI suggestions never auto-accepted; DRI comparison only within one methodology version; snapshot-at-submit for every score, DRI and credential decision; localization cannot alter assessments.

[changed] v1's fixed FLOW_PASS_MARK_PCT = 70 moves to §45.1 as a governance-owned default (§19).

§45.3 Open decisions (build as config; do not invent values)
DRI definition and methodology
DRI thresholds, if any
Certification pass criteria (and whether flow pass marks leave 70)
Passport requirements and transcript format
Retest policy for compliance and domain exams
External proctoring provider, if any
Result release policy per assessment kind
Credential validity and Passport renewal period
Overlay delivery model per employer
Claims flow → week mapping and new AI-assisted / integration flows
Manual vs automated reasoning evaluation
Final role/permission matrix (esp. trainer vs evaluator)
Data and evidence retention periods
Final audit requirements
Certification governance authority (interim governance_admin holders)
Block 2 structure (fused vs pure compliance)
Second domain pack
Credential naming, number formats and co-branding rules
Whether DRI or reasoning score enters the leaderboard or at-risk model
§46 — Migration from Praxis v1 [new]

A one-way, idempotent v1 import job (apps/api/src/services/v1-import/) runs against a read-only v1 database and v1 object storage.

v1	v2	Notes
93 flow bundles	packs/claims/flows/<code>/	Delete ignored v2–v5 navigator.json; reject field-level visibleWhen; rename assignment keys in state.json; validate variant provider data
scenarios / sub-scenarios	modules / sub-modules in claims pack	Mapped to weeks 9–10 via pack manifest
claims, claim variants	subjects, subject variants	DCN- refs preserved
claim_decision_type values	pack decision keys pay / deny; NULL preserved	
MCQ bank	MCQ bank, version 1 of each question	
users, trainers, trainees	same tables	HYTE- / CRTR- IDs preserved; sequences realigned
historical attempts and sittings	not imported by default	v1 stays the system of record for its history; optional archive import is a separate decision
app_config rows	same keys	Copied with an audit row per key
email templates	same keys + new keys	Admin-edited copy preserved

Run order: users → packs → MCQ → config → cohorts (optional). Each step writes sync_state and is safe to re-run.

Appendix A — Trainee journey
text
SIGN IN (OTP) → JOIN COHORT (track version, market, institution)
  ↓
BLOCK 1 — FOUNDATIONS (wk 1–4) → go/no-go
  ↓  progression gate
BLOCK 2 — PASSPORT + REASONING (wk 5–8)
  ├─ Compliance Exam 1 (wk 5, proctored)
  ├─ Compliance Exam 2 (wk 6, proctored) → PASSPORT ISSUED
  ├─ Reasoning I / II (wk 7–8)
  └─ DRI BASELINE sitting (wk 8)
  ↓  progression gate
BLOCK 3 — CLAIMS PACK (wk 9–12)
  ├─ Workbench flows: Training (Navigator) → Practice (earned per flow)
  ├─ AI-assisted verification flows (wk 11)
  └─ Integration flows (wk 12)
  ↓  assessment eligibility (N perfect runs)
DOMAIN EXAM (proctored) → domain score + reasoning score + final DRI
  ↓
CLAIMS CERTIFICATION (+ endorsements from later tracks)
  ↓
OPTIONAL EMPLOYER OVERLAY (+2–4 wks) → EMPLOYER ONBOARDING RECORD
Appendix B — Starter CLAUDE.md
markdown
# Praxis v2 — agent guidance

Spec: docs/SPEC.md (cite §). v1 behaviour reference: docs/v1-SPEC.md, only where SPEC marks [v1].
Precedence: code > docs/SPEC.md > openspec/specs > docs/v1-SPEC.md > design docs.

## Non-negotiables
- Domain content is pack configuration. No claim/DCN/pay/deny names in core services.
- No hard-coded pass marks, weights, DRI formulas, thresholds, caps, durations,
  renewal periods or progression rules — use the §45 config surfaces.
- Scores, DRI results and credential decisions are snapshotted at write; never re-derived.
- Attempts, sittings, traces, DRI, credentials, audit and email logs are append-only.
- Progression, eligibility, scoring, visibility, RBAC: server-side only. UI renders lock reasons.
- Strip answer keys, reference reasoning and assist correctness from trainee responses.
- AI suggestions are never copied into a submission; require verify + resolution.
- NULL decision is a valid correct answer.
- No real PHI. No pricing/billing.
- Every state change to content, scores, config, roster, standards, credentials → audit_log.

## Workflow
- OpenSpec: propose → apply → archive; one domain per change.
- Zod schema first → route → store → viewmodel → view (strict MVVM, no direct fetch).
- Drizzle query builder only; no `any`; ID helpers only.
- Tests for touched acceptance criteria; coverage is a ratchet; hooks are develop's CI.
- Governance-needed values: config with a flagged default; say so in the PR.
- Branch: develop. Commits: feat|fix|schema|api|ui|store|seed|test|chore|pack.

## Commands
pnpm dev | build | lint | typecheck | test | test:db | format:check
pnpm db:push | db:seed | db:migrate | db:studio | packs:validate | packs:sync

Engineering principle: Praxis v2 is v1's proven engines — bundle-driven workbench, navigator, rubric scoring, normalization, proctoring, audit — generalized into a configurable certification engine. Claims is the first pack, not the architecture.