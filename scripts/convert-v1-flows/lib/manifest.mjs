/**
 * `packs/claims/pack.json` (§5, §40; tasks 6.1, 6.1a, 6.2).
 *
 * The manifest is the only thing core code knows about a pack (§5), so every
 * domain vocabulary belongs here rather than in a service, a shared package or
 * a client-side map.
 *
 * The flow → week mapping is present but UNASSIGNED. It is an open governance
 * decision (§45.3) and this conversion refuses to invent it: nothing infers a
 * week from a flow code, a directory name or a source comment.
 */

export const PACK_ID = "claims"
export const PACK_VERSION = "1.0.0"

export const PACK_FILES = {
  manifest: "pack.json",
  glossary: "glossary.md",
  report: "conversion-report.md",
}

/** Subject-ref prefix (§40). The core has no `formatDcn` — this is pack data. */
export const SUBJECT_REF_PREFIX = "DCN-"
export const SUBJECT_REF_DIGITS = 6

/**
 * Build the manifest from the vocabularies observed in the content.
 *
 * Nothing here is hard-coded from the spec's prose: `decisionOptions` comes
 * from what the bundles actually offer, which is how the third key (`pend`) was
 * found. A manifest written from §5's text would have declared two and refused
 * a trainee who picked the distractor.
 */
export function buildPackManifest({
  decisionOptions,
  reasonCodes,
  bypassCodes,
  flowCodes,
}) {
  return {
    $schema: "praxis/v2/pack",
    id: PACK_ID,
    version: PACK_VERSION,
    title: "Claims Operations",
    domain: "claims",

    description:
      "v1's claims content, generalized. Block 3 of the Claims Operations track " +
      "(§4.2, §4.3). Claims is the first pack, not the architecture.",

    glossary: PACK_FILES.glossary,

    /**
     * Every decision key the pack's content offers a trainee (§5).
     *
     * `pend` is a distractor — no rubric expects it — and is declared anyway:
     * the server validates a submitted decision against this list, so an
     * undeclared distractor would be refused instead of scored wrong.
     */
    decisionOptions: [...decisionOptions.keys()].sort().map((key) => ({
      key,
      label: decisionOptions.get(key) || key,
    })),

    /**
     * A `NULL` decision is a first-class CORRECT answer, not a missing one
     * (§5). 6 flows depend on it; 5 of them score it at weight 20.
     */
    allowsNoDecision: true,

    /**
     * Reason codes, unified (design D10).
     *
     * v1 split these between `REJECT_CODE_CATALOG` in core code and the codes
     * bundles author, and the two had drifted. One pack-authored vocabulary
     * cannot drift from itself.
     *
     * This list is also the distractor pool the deny picker is padded from: a
     * flow authors only the codes it expects, and the server pads to
     * `MIN_REJECT_CODE_OPTIONS` before shuffling (§14.1).
     */
    reasonCodes: [...reasonCodes.entries()].map(([code, label]) => ({
      code,
      label: label || code,
    })),

    /**
     * PX edit bypass codes — a separate vocabulary from the reason codes above:
     * short rather than long, and used to bypass an edit rather than deny a
     * claim. v1 authors them inline as `f_er_bypass_code` options with the code
     * as its own label.
     */
    editBypassCodes: [...bypassCodes.entries()].map(([code, label]) => ({
      code,
      label: label || code,
    })),

    /** Pack-defined subject-ref format (§40). */
    formatSubjectRef: {
      prefix: SUBJECT_REF_PREFIX,
      digits: SUBJECT_REF_DIGITS,
      example: `${SUBJECT_REF_PREFIX}606101`,
    },

    /**
     * Flow → week mapping — OPEN GOVERNANCE DECISION (§45.3).
     *
     * Present and unassigned on purpose. Weeks 9–10 cannot be populated until
     * governance settles it, and expressing it also needs the scenario → module
     * mapping, which lives in the v1 database rather than in the flow files.
     */
    moduleWeekMapping: {
      approved: false,
      approvalNote:
        "not approved — the claims flow → week mapping is an open decision (§45.3). " +
        "No week is inferred from a flow code, directory name or source comment.",
      weeks: {},
      unassignedFlows: [...flowCodes].sort(),
    },

    /**
     * Exam blueprints (§5) are not authored by this change: a blueprint draws
     * on the week mapping above, which is unapproved.
     */
    examBlueprints: {
      approved: false,
      approvalNote:
        "not approved — blueprints depend on the unapproved flow → week mapping (§45.3).",
      blueprints: [],
    },
  }
}

/**
 * `packs/claims/glossary.md` (§5, task 6.3).
 *
 * §5 names the terms this pack must carry. Definitions are written from what
 * the flow content actually does with each term, so the glossary describes the
 * pack rather than restating the spec.
 */
export function buildGlossary({ reasonCodeCount, bypassCodeCount }) {
  return `# Claims glossary

Domain terms for the ${PACK_ID} pack (\`docs/SPEC.md\` §5). These are pack
vocabulary, not platform concepts: no core service should know any of them.

## Subject

**DCN** — Document Control Number, the claim's reference. This pack's subject-ref
format (\`${SUBJECT_REF_PREFIX}######\`), declared in \`pack.json\` as
\`formatSubjectRef\` (§40). The core has no \`formatDcn\`.

## Decisions

**Pay** — adjudicate the claim as payable.

**Deny** — reject the claim, with a reason code.

**Pend** — hold the claim rather than deciding it. Offered by 5 flows as a
distractor: no rubric expects it, and choosing it is scored wrong.

**No decision** — submitting without a decision. A first-class **correct**
answer, stored as \`NULL\` (§5). 6 flows are graded on it. Code that treats it
as "didn't answer" is wrong.

## Codes

**PX edit** — a system edit raised against a claim on the Event Resolution tab.
Each carries a short \`PX_*\` bypass code; this pack declares
${bypassCodeCount} of them as \`editBypassCodes\`.

**Reject / reason code** — the long \`PX_*\` code recorded with a denial, e.g.
\`PX_R21410\` for a claim past its timely-filing limit. This pack declares
${reasonCodeCount} as \`reasonCodes\`, which is also the distractor pool the deny
picker is padded from (§14.1).

**SPS** — the provider's system id. Several flows turn on confirming that a
search result's row ID equals the SPS shown in Provider Information → Billing.

**Non-PAR** — a non-participating provider: no contract with the plan, so
pricing and member liability follow out-of-network terms.

**PCM ticket** — a Pricing/Claims Management request raised to obtain pricing
the workbench does not hold. The claim is submitted with no decision while
pricing is pending, which is why "no decision" has to be a correct answer.

**Write-off code** — the code recorded when a balance is written off rather than
paid or denied.

## Amounts

**EOB** — Explanation of Benefits: the amounts breakdown accompanying a claim.

**Accumulators** — the member's running deductible and out-of-pocket totals that
a benefit decision is read against.

**COB** — Coordination of Benefits: which plan pays first when a member has more
than one.
`
}
