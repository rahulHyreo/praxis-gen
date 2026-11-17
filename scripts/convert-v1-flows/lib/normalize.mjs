/**
 * Normalized-JSON comparison (design D4).
 *
 * Duplicate detection is semantic, not byte-wise. This matters more than it
 * sounds: a naive byte comparison of v1's variant navigators finds 164 of 364
 * "different", but only 12 differ semantically — the other 152 are the same
 * content reformatted. Byte comparison would have carried 152 inert files into
 * the pack and overstated the §13 defect by an order of magnitude.
 *
 * Normalization is for COMPARISON ONLY. Files are written preserving their
 * original key order (see lib/write.mjs), so the pack diff against v1 stays
 * readable.
 */

/**
 * Recursively sort object keys. Arrays keep their order — order is meaning in
 * a navigator's `steps` or a table's rows, so sorting them would equate
 * genuinely different content.
 */
export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key])
    return out
  }
  return value
}

/** A stable string for one JSON value, independent of key order and whitespace. */
export function normalizedJson(value) {
  return JSON.stringify(sortKeys(value))
}

/** True when two parsed JSON values are the same content. */
export function isSemanticallyEqual(a, b) {
  return normalizedJson(a) === normalizedJson(b)
}

/**
 * Every leaf difference between two JSON values, as `{ path, a, b }`.
 *
 * Used by the report to say WHAT diverges in a variant that is carried, so a
 * reviewer can see it is a graded value rather than noise.
 */
export function diffPaths(a, b, path = "", out = []) {
  if (normalizedJson(a) === normalizedJson(b)) return out

  const kind = (v) => (Array.isArray(v) ? "array" : typeof v)
  const ka = kind(a)
  const kb = kind(b)

  if (ka !== kb || (ka !== "object" && ka !== "array")) {
    out.push({ path, a, b })
    return out
  }

  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
  for (const key of keys) {
    diffPaths(a?.[key], b?.[key], path ? `${path}.${key}` : key, out)
  }
  return out
}
