/**
 * The no-domain-names guard (docs/SPEC.md §43).
 *
 * Separated from its test file so the matcher itself can be tested — a guard
 * nobody has tested is a guard nobody knows the shape of, and this one's whole
 * value is that it fires on the right things and stays quiet on the wrong ones.
 * A guard that cries wolf gets deleted.
 */

/**
 * Pack vocabulary barred from core services.
 *
 * These are Claims-pack words. §Non-negotiables: "No domain-specific names
 * (claim, DCN, Pay/Deny) in core logic." They belong in `packs/claims/`, whose
 * `pack.json` declares `decisionOptions: ["pay", "deny"]` and whose
 * `formatSubjectRef` prefix produces `DCN-######`. Core code stores whatever
 * validated string key was submitted and never names one (§5).
 *
 * Do NOT add a term from another pack speculatively. The list should name
 * vocabulary that has actually threatened to leak; a long list of hypotheticals
 * raises the false-positive rate, which is how a guard loses its credibility.
 */
export const PACK_VOCABULARY = ["claim", "dcn", "pay", "deny"] as const

export type PackTerm = (typeof PACK_VOCABULARY)[number]

/**
 * Directories swept, relative to `apps/api/src/`.
 *
 * `services/` is the one §43 names, because that is where decisions live.
 * `routes/`, `middleware/` and `lib/` are included too: a route that names a
 * claim in a path or a payload key has leaked the same vocabulary into the API
 * surface, which is harder to change later than a service internal.
 */
export const SWEPT_DIRECTORIES = [
  "services",
  "routes",
  "middleware",
  "lib",
] as const

/**
 * Files permitted to use pack vocabulary: pack-scoped adapters.
 *
 * **EMPTY, and that is the correct state today.** There is no pack-scoped
 * adapter in this repository yet — no bundle loader, no decision serialiser,
 * nothing that has to speak a pack's language. Everything swept is genuinely
 * domain-neutral.
 *
 * A DECLARED ARRAY, never a glob (§43, design D4). Adding an entry is a visible
 * diff in review, which is the point: a pattern broad enough to cover
 * "adapters" would silently absorb the next violation too, and the guard would
 * go on passing while the boundary eroded.
 *
 * Before adding an entry, check the alternative. Most apparent needs are really
 * a sign that pack vocabulary has reached a layer it should not have — the fix
 * is usually to pass a validated opaque key through core code and let the pack
 * give it meaning, not to permit the word here.
 *
 * Paths are relative to `apps/api/src/`, exactly as the sweep reports them.
 */
export const ALLOW_LIST: readonly string[] = []

export interface Violation {
  /** Path relative to `apps/api/src/`, as the sweep reports it. */
  file: string
  /** 1-indexed line number. */
  line: number
  term: PackTerm
  /** The offending line, for the failure message. */
  text: string
}

const VOCABULARY = new Set<string>(PACK_VOCABULARY)

/**
 * Split a line into lowercased words, breaking on camelCase as well as on
 * punctuation.
 *
 * A TOKENIZER, NOT A REGEX, and the reason is worth knowing. The obvious
 * implementation is a case-insensitive word-boundary match per term, and it is
 * subtly wrong: in JavaScript the `i` flag also applies inside a lookahead, so
 * `(?![a-z])` means "not followed by a letter of either case" and `claimId`
 * stops matching. A first version of this guard did exactly that and passed its
 * own tree while failing to flag `claimId` — the single most likely way the
 * vocabulary would actually arrive.
 *
 * Tokenizing instead makes both halves of the requirement explicit:
 *
 *   flagged      claim · Claim · CLAIM · claimId · subjectDcn · doPay() ·
 *                subject.claim · 'deny' · DcnRef
 *   not flagged  payload · payer · repayment · denylist · displayName · okpay
 *
 * That second row is what keeps the guard alive. A naive `includes()` would
 * flag `payload`, a word this codebase uses constantly, and the guard would be
 * switched off within a day — a disabled guard is worse than none, because the
 * boundary then erodes with no one watching.
 */
export function tokenize(line: string): string[] {
  return (
    line
      // camelCase and PascalCase: claimId → claim Id
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      // An acronym followed by a word: DCNRef → DCN Ref
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      // Everything else that separates words.
      .replace(/[^A-Za-z0-9]+/g, " ")
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
  )
}

/**
 * Find every pack-vocabulary occurrence in one file's text.
 *
 * `allowList` is injectable so the matcher can be tested against a list of its
 * own; production callers use the default.
 */
export function findPackVocabulary(
  file: string,
  text: string,
  allowList: readonly string[] = ALLOW_LIST
): Violation[] {
  if (allowList.includes(file)) return []

  const violations: Violation[] = []

  text.split(/\r?\n/).forEach((line, index) => {
    // One violation per distinct term per line: a line naming the same term
    // twice is one thing to fix, but a line naming two terms is two.
    const seen = new Set<string>()
    for (const word of tokenize(line)) {
      if (!VOCABULARY.has(word) || seen.has(word)) continue
      seen.add(word)
      violations.push({
        file,
        line: index + 1,
        term: word as PackTerm,
        text: line,
      })
    }
  })

  return violations
}
