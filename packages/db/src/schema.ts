/**
 * Drizzle schema for Praxis v2.
 *
 * DELIBERATELY EMPTY. docs/SPEC.md §40 states that "the v2 migration set starts
 * fresh (0000_init)" — V1's schema is not carried, and a separate v1 import job
 * (§46) moves V1's data. Each table group below arrives with the change that
 * owns it, so that a migration is reviewed alongside the service and routes
 * that read it rather than landing as one unreviewable initial dump.
 *
 * Conventions when adding a group (§40): snake_case table names, Postgres
 * enums, Drizzle query builder only, and identifiers exclusively through
 * ./ids.ts. No pack vocabulary (claim, DCN, pay, deny) in any table, column or
 * enum name — domain content is pack configuration, not schema
 * (§Non-negotiables).
 *
 * §40 table groups, and the §41 phase that adds each:
 *
 *   auth          users, sessions, accounts, verification            [v1]  A
 *   roster        cohorts, trainees, trainers, cohort_trainers,            A
 *                 cohort_evaluators, attendance, transfers           [v1]
 *   org           markets, institutions, employers                   [new] A
 *   program       programs, program_versions, tracks, track_versions, [new] A
 *                 blocks, weeks, track_modules, modules, sub_modules,
 *                 sub_module_questions, activities
 *   packs         packs, pack_versions, cohort_pack_versions         [new] A
 *   audit         audit_log, api_request_log                         [v1]  A
 *   content       content_items, content_item_versions,              [new] B
 *                 trainee_content_progress
 *   progression   progression_rule_sets, trainee_gate_events,        [new] B
 *                 trainee_module_unlocks
 *   subjects      flows, flow_variants, subjects, subject_variants,  [v1]  C
 *                 subject_links, flow_questions
 *   progress      trainee_attempts, attempt_step_results,            [v1]  C
 *                 attempt_tab_visits, attempt_field_interactions,
 *                 attempt_question_answers, trainee_flows
 *   assessment    assessments, assessment_versions,                  [v1]  D
 *                 trainee_assessment_sessions,
 *                 assessment_session_phase,
 *                 trainee_assessment_flow_attempts
 *   mcq           mcq_categories, mcq_questions,                     [v1]  D
 *                 mcq_question_versions
 *   proctoring    proctoring_settings, recordings, violations,       [v1]  D
 *                 recording_retention_settings
 *   reasoning     reasoning_traces, attempt_ai_resolutions,          [new] E/F
 *                 consistency_measurements, reasoning_evaluations
 *   dri           dri_methodologies, dri_results,                    [new] E
 *                 dri_component_scores
 *   standards     pass_standards                                     [new] G
 *   credentials   compliance_passports, passport_requirements,       [new] G
 *                 passport_renewals, credential_types,
 *                 credential_requirement_sets, credentials,
 *                 credential_endorsements, credential_status_history,
 *                 evidence_packages
 *   operations    leaderboard_entries, trainer_notes, daily_tips,    [v1]  H
 *                 guides, report_exports, app_config,
 *                 email_templates, email_log, sync_state
 *   overlay       employer_overlays, overlay_enrollments,            [new] I
 *                 employer_onboarding_records
 *   outcomes      external_outcomes                                  [new] I
 *
 * §40 also lists what V1 had that v2 drops and must NOT be reintroduced:
 * workspace_schemas, navigator_schemas and navigator_steps (bundles own these),
 * flows.eligible* cache columns, the training_mode enum, proxy_violations, and
 * the claim_decision_type enum (decision vocabulary is pack-authored, §5).
 */

// Nothing is exported yet. The empty export keeps this a module, so
// `import * as schema from "./schema.js"` in ./client.ts resolves and
// `drizzle(pool, { schema })` receives an empty schema object rather than
// failing to resolve the import.
export {}
