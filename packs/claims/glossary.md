# Claims glossary

Domain terms for the claims pack (`docs/SPEC.md` §5). These are pack
vocabulary, not platform concepts: no core service should know any of them.

## Subject

**DCN** — Document Control Number, the claim's reference. This pack's subject-ref
format (`DCN-######`), declared in `pack.json` as
`formatSubjectRef` (§40). The core has no `formatDcn`.

## Decisions

**Pay** — adjudicate the claim as payable.

**Deny** — reject the claim, with a reason code.

**Pend** — hold the claim rather than deciding it. Offered by 5 flows as a
distractor: no rubric expects it, and choosing it is scored wrong.

**No decision** — submitting without a decision. A first-class **correct**
answer, stored as `NULL` (§5). 6 flows are graded on it. Code that treats it
as "didn't answer" is wrong.

## Codes

**PX edit** — a system edit raised against a claim on the Event Resolution tab.
Each carries a short `PX_*` bypass code; this pack declares
28 of them as `editBypassCodes`.

**Reject / reason code** — the long `PX_*` code recorded with a denial, e.g.
`PX_R21410` for a claim past its timely-filing limit. This pack declares
20 as `reasonCodes`, which is also the distractor pool the deny
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
