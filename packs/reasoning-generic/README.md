# reasoning-generic pack

**Block 2, weeks 7–8** (`docs/SPEC.md` §4.2, §4.3). Output: the first scored
reasoning traces and the DRI baseline sitting.

| Week | Content                                                                              | Output                        |
| ---- | ------------------------------------------------------------------------------------ | ----------------------------- |
| 7    | Reasoning I: rule → facts → conclusion; traces; calibration                          | First scored reasoning traces |
| 8    | Reasoning II: noise & consistency, inter-rater, base rates, escalation, articulation | DRI baseline sitting          |

Empty until the Reasoning Core change authors it (§20, §21).

**Domain-neutral by design, and that is the point.** These are short cases with
a `reasoning.json`, usually a small `ui.json` and no navigator weight (§20). The
pack is named `reasoning-generic` because the Reasoning Core measures how a
trainee reasons, not what they know about claims — the same bank is the DRI
baseline for every future domain pack.

Two things this pack must not contain: pack-specific vocabulary from another
domain, and a DRI formula. The DRI methodology is governance-owned, versioned
configuration (§21, §45.1) with a placeholder v0 flagged "not approved" — never
a literal in content or code.

§45.3 leaves Block 2's structure open: the engine must also support reasoning
moving into Block 3, with Block 2 as pure compliance. Nothing here should assume
week 7–8 placement beyond the module→week mapping in `pack.json`.
