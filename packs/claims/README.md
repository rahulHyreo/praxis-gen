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

The v1 import has run: `flows/` holds 92 flow groups and 930 files, with
`pack.json`, `glossary.md` and `conversion-report.md` beside it. The §14.3
weeks 11–12 flows are still to be authored. Re-run the import with
`pnpm packs:convert-v1 <v1>/apps/api/src/data/flows`; it is idempotent, so a
re-run on unchanged content leaves the tree untouched.

**Read `conversion-report.md` before trusting anything here.** It records what
was carried, what was dropped and why, the governance surfaces left unapproved,
and the one content defect the import found rather than fixed.

## Where its content comes from

v1's **92 flow bundles** are imported here as `flows/<code>/` — a base bundle
plus v2–v5 variant folders (§13) — and v1's scenarios and sub-scenarios become
modules and sub-modules. Weeks 9–10 draw on those directly; **weeks 11–12 need
new flows** that do not exist in v1 (AI-assisted verification and integration).
The flow→week mapping is authored in `pack.json`, not inferred.

The import is not a copy. §13 and §46 name three v1 defects to fix rather than
carry, and on the real source only one of them exists:

- **Duplicate variant files — real.** 1,444 of the 1,820 variant files were
  copies of their base, or differed but were never served. Dropping them cut the
  pack from 111.7 MB to 36.1 MB. A variant folder now holds only what varies,
  which for 90 of the 92 flows is `data.json` alone.
- **Field-level `visibleWhen` — not present.** All 165 occurrences are
  section-level. The import asserts this rather than claiming a fix.
- **The legacy `assignment` mode key — not present.** Every `state.json`
  already uses `training` / `practice` / `assessment`, and `DEMO.1` adds the
  unscored `demo` workspace mode (§16). Asserted, not renamed.

Two flows, `507.3` and `W-DMX.2`, keep their own per-variant `navigator.json`,
and `W-DMX.2` its own `state.json`: v1 serves them and their steps carry
variant-specific **graded** values. §13's blanket rule would have broken their
grading, so it is narrowed to reject only a variant navigator that _duplicates_
its base.

## Pack-authored vocabulary

v1's `claim_decision_type` enum becomes this pack's `decisionOptions` — **three**
keys, `deny` / `pay` / `pend`, not the two §5 cites. 87 flows offer `[pay, deny]`;
5 also offer `pend`. No rubric expects `pend`, so it is a distractor, and it is
declared anyway: the server validates a submitted decision against this list, so
an undeclared distractor would be refused instead of scored wrong.

Reject/reason codes become one pack vocabulary of 20 codes with labels (§5). v1
split them between a `REJECT_CODE_CATALOG` in `packages/shared` and the codes
bundles author, and the two had drifted by 5 codes. The 28 PX **edit bypass**
codes are a separate vocabulary — short (`PX_CB`) rather than long
(`PX_RNBE00`), and used to bypass an edit rather than deny a claim.

§14.1's `MIN_REJECT_CODE_OPTIONS = 5` is **server-side padding** from that
vocabulary, not a property of a bundle: a flow authors only the codes it expects,
1 to 3 of them, and all 23 deny flows are under 5.

Subject references keep the `DCN-######` format through this pack's
`formatSubjectRef` prefix (§40) — the core has no `formatDcn`. Each
`flows/<code>/flow.json` carries the flow's name and, per variant, the subject
refs it populates: 2,639 in all, and the index that routes a subject to a bundle.

A `NULL` decision stays a first-class **correct** answer (§5). Code that treats
it as "didn't answer" is wrong.

The glossary belongs here too: PX edits, SPS, Non-PAR, PCM ticket, write-off
codes (§5).
