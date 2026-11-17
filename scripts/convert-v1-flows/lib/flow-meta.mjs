/**
 * Flow metadata and the subject index, recovered from `index.ts`.
 *
 * The five bundle files are not the whole bundle. v1's `index.ts` builds each
 * variant's bundle object from them and adds four things that exist nowhere
 * else:
 *
 *   flowSlug      "088.1" / "088.1/v2"
 *   flowName      "Pricing PCM Ticket (PX_088) — Verify & Pay"
 *   variantIndex  1..5
 *   dcns          the subject refs this variant populates
 *
 * `flowName` is not `ui.json`'s `name` — 088.1 is "Pricing PCM Ticket (PX_088)
 * — Verify & Pay" in one and "Edit 088.1 — Pricing PCM Ticket" in the other.
 *
 * `dcns` matters most: it is the SUBJECT INDEX that `resolveBundleSource(subject)`
 * needs to route a subject ref to a bundle and variant, and §46 requires
 * "DCN- refs preserved". 2,644 refs live here and only 460 of them appear
 * anywhere in a `data.json`, so dropping `index.ts` without extracting this
 * would lose the routing for 2,203 subjects — silently, because every other
 * check would still pass.
 */

export class FlowMetaError extends Error {}

/**
 * `flowName:` takes one of three forms across the 92 flows, so all three are
 * resolved rather than assuming the common one:
 *
 *   flowName: "COB — 6X ..."              85 bundles — an inline literal
 *   flowName: FLOW_NAME                   75 bundles — a module constant,
 *                                         whose value is on the NEXT line
 *   flowName: flowX41Bundle.flowName      variant bundles referring to base
 *
 * A member expression resolves to the base bundle's name, which is what the
 * flow is called, so only the base literal has to be found.
 */
const FLOW_NAME_LITERAL_PATTERN = /flowName:\s*"((?:[^"\\]|\\.)*)"/
const FLOW_NAME_IDENTIFIER_PATTERN = /flowName:\s*([A-Za-z_$][\w$]*)\s*,/
const constantPattern = (name) =>
  new RegExp(`const\\s+${name}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`)

/** `variantIndex: 2,` */
const VARIANT_INDEX_PATTERN = /variantIndex:\s*(\d+)/

/** `dcns: [ ... ]` — the array spans lines when it holds more than one. */
const DCNS_PATTERN = /dcns:\s*\[([^\]]*)\]/

/** A quoted subject ref inside a `dcns` array. */
const QUOTED_REF_PATTERN = /"([^"]+)"/g

/**
 * Slice the object literal for one bundle, anchored on its `flowSlug`.
 *
 * Anchoring on `flowSlug` rather than the export name keeps this independent of
 * v1's `flow<NNNN>V2Bundle` naming, which varies with the flow code.
 */
function sliceBundleLiteral(indexSource, slug) {
  const anchor = indexSource.indexOf(`flowSlug: "${slug}"`)
  if (anchor === -1) return null
  const close = indexSource.indexOf("} as const", anchor)
  return indexSource.slice(anchor, close === -1 ? indexSource.length : close)
}

/** Resolve the base bundle's `flowName`, whichever of the three forms it takes. */
function resolveFlowName({ code, flatBase, flat }) {
  const literal = FLOW_NAME_LITERAL_PATTERN.exec(flatBase)
  if (literal) return literal[1].replace(/\\"/g, '"')

  const identifier = FLOW_NAME_IDENTIFIER_PATTERN.exec(flatBase)
  if (identifier) {
    const resolved = constantPattern(identifier[1]).exec(flat)
    if (resolved) return resolved[1].replace(/\\"/g, '"')
    throw new FlowMetaError(
      `${code}: index.ts sets flowName to "${identifier[1]}", but no string constant of that ` +
        `name is declared in the module. Refusing to guess the flow's name.`
    )
  }

  throw new FlowMetaError(
    `${code}: index.ts declares no resolvable flowName for the base bundle. ` +
      `Its shape changed — review lib/flow-meta.mjs.`
  )
}

function parseRefs(literal, { code, slug }) {
  const match = DCNS_PATTERN.exec(literal)
  if (!match) {
    throw new FlowMetaError(
      `${code}: index.ts declares no dcns array for "${slug}". That array is the subject index ` +
        `§46 requires preserved — refusing to write a flow with no subject refs.`
    )
  }
  const refs = [...match[1].matchAll(QUOTED_REF_PATTERN)].map((m) => m[1])
  if (refs.length === 0) {
    throw new FlowMetaError(
      `${code}: the dcns array for "${slug}" is empty. Every bundle populates at least one subject.`
    )
  }
  return refs
}

/**
 * Extract a flow's metadata and per-variant subject refs.
 *
 * Returns `{ flowName, base: { variantIndex, subjectRefs }, variants: {...} }`.
 */
export function extractFlowMeta({ code, indexSource, variants }) {
  if (!indexSource) {
    throw new FlowMetaError(
      `${code}: no index.ts, so the flow name and subject index cannot be recovered.`
    )
  }

  // Normalized so a declaration whose value sits on the next line still
  // matches — `const FLOW_NAME =` is written that way in 75 of the 92 flows.
  const flat = indexSource.replace(/\s+/g, " ")

  const baseLiteral = sliceBundleLiteral(indexSource, code)
  if (!baseLiteral) {
    throw new FlowMetaError(
      `${code}: index.ts declares no bundle with flowSlug "${code}".`
    )
  }
  const flatBase = baseLiteral.replace(/\s+/g, " ")

  const flowName = resolveFlowName({ code, flatBase, flat })

  const baseIndex = VARIANT_INDEX_PATTERN.exec(baseLiteral)

  const meta = {
    flowName,
    base: {
      variantIndex: baseIndex ? Number(baseIndex[1]) : 1,
      subjectRefs: parseRefs(baseLiteral, { code, slug: code }),
    },
    variants: {},
  }

  for (const variant of variants) {
    const slug = `${code}/${variant.name}`
    const literal = sliceBundleLiteral(indexSource, slug)
    if (!literal) {
      throw new FlowMetaError(
        `${code}: a ${variant.name}/ directory exists but index.ts declares no bundle with ` +
          `flowSlug "${slug}".`
      )
    }
    const variantIndex = VARIANT_INDEX_PATTERN.exec(literal)
    meta.variants[variant.name] = {
      variantIndex: variantIndex ? Number(variantIndex[1]) : null,
      subjectRefs: parseRefs(literal, { code, slug }),
    }
  }

  return meta
}

/**
 * Build the `flow.json` written beside a flow's bundle files.
 *
 * Stored per flow rather than as one pack-level reverse index: the reverse map
 * is derivable at load time, and duplicating 2,644 refs would give the pack two
 * copies of one fact to disagree about.
 */
export function buildFlowManifest({ code, meta }) {
  return {
    $schema: "praxis/v2/pack-flow",
    code,
    name: meta.flowName,
    variants: [
      {
        variant: "base",
        variantIndex: meta.base.variantIndex,
        subjectRefs: meta.base.subjectRefs,
      },
      ...Object.entries(meta.variants).map(([name, variant]) => ({
        variant: name,
        variantIndex: variant.variantIndex,
        subjectRefs: variant.subjectRefs,
      })),
    ],
  }
}

/**
 * Find subject refs claimed by more than one bundle.
 *
 * A ref should route to exactly one bundle: two claimants make
 * `resolveBundleSource(subject)` ambiguous, and which bundle a trainee is
 * served depends on iteration order.
 *
 * This is REPORTED, not fatal. The one collision in this source —
 * `DCN-606105`, claimed by `ZLL.1` and `ZLS.1`, two related vendor-pricing
 * flows — is a pre-existing v1 authoring slip, not a conversion error. Fixing
 * it means renumbering one flow's claim, which is an authoring decision this
 * conversion must not invent (§45.3 reasoning), and refusing to migrate 2,644
 * refs over one of them would be the wrong trade. So it goes in the report as a
 * defect needing a decision, the same way dead content does.
 */
export function findSubjectRefCollisions(claims) {
  const owners = new Map()
  const collisions = []

  for (const { ref, owner } of claims) {
    if (owners.has(ref)) {
      collisions.push({ ref, first: owners.get(ref), second: owner })
    } else {
      owners.set(ref, owner)
    }
  }

  return { uniqueRefs: owners.size, collisions }
}
