# claims pack

**Block 3, weeks 9–12** (`docs/SPEC.md` §4.2, §4.3). Output: certification —
domain score, reasoning score and final DRI (§23, §28).

This is v1's content, generalized: "Claims is the first pack, not the
architecture."

| Week | Content                                                                              | Output                         |
| ---- | ------------------------------------------------------------------------------------ | ------------------------------ |
| 9    | Claim lifecycle; CPT / ICD-10 / HCPCS; EOB anatomy                                   | Workbench flow set wk 9        |
| 10   | Adjudication logic, denials, COB, timely filing, adjustments; platform concepts      | Workbench flow set wk 10       |
| 11   | AI-assisted adjudication: verify copilot output, catch plausible-but-wrong decisions | Adversarial verification flows |
| 12   | Integration: manual, AI-assisted and exception flows                                 | Proctored domain exam          |

Empty until the v1 import runs (§46) and the §14.3 flows are authored.

## Where its content comes from

v1's **93 flow bundles** are imported here as `flows/<code>/` — a base bundle
plus v2–v5 variant folders (§13) — and v1's scenarios and sub-scenarios become
modules and sub-modules. Weeks 9–10 draw on those directly; **weeks 11–12 need
new flows** that do not exist in v1 (AI-assisted verification and integration).
The flow→week mapping is authored in `pack.json`, not inferred.

The import is not a copy. §13 and §46 require it to fix three v1 defects rather
than carry them: delete the ignored `navigator.json` in every v2–v5 variant
folder (v1 serves the base one to every variant), reject field-level
`visibleWhen` (v1 silently ignores it), and fail any flow whose variants
contradict their own graded data. It also renames the legacy `assignment` mode
key inside every variant's `state.json` (§16).

## Pack-authored vocabulary

v1's `claim_decision_type` enum becomes this pack's `decisionOptions:
["pay", "deny"]`, and its reject/reason codes become a pack vocabulary (§5).
Subject references keep the `DCN-######` format through this pack's
`formatSubjectRef` prefix (§40) — the core has no `formatDcn`.

A `NULL` decision stays a first-class **correct** answer (§5). Code that treats
it as "didn't answer" is wrong.

The glossary belongs here too: PX edits, SPS, Non-PAR, PCM ticket, write-off
codes (§5).
