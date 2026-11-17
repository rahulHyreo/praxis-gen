/**
 * v1's bespoke sub-tab bindings, lifted out of client code (design D7, task 2.2).
 *
 * §14.2's defect: no v1 `ui.json` carries a `component` key. Instead v1 binds
 * 20 sub-tab ids to 13 components in a web-app map
 * (`customSubTabRenderers.tsx`), so which component renders a sub-tab is
 * invisible to the pack. Since that is rendering configuration, it is pack data
 * (§5), and conversion writes it into the converted `ui.json`.
 *
 * `dataPath` evidence is OBSERVED, not declared. The components document their
 * data paths in prose — "Providers are read from the flow bundle data
 * (`search.provider.results`)" — rather than in a machine-readable contract.
 * This module collects backtick-quoted dotted paths from each component and its
 * sibling `*.types.ts` as *candidates*, which is what the spec asks for: the
 * evidence the phase-C registry needs, not a validated contract. The report
 * says so, so nobody mistakes a candidate for a verified path.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

export class BespokeMapError extends Error {}

/** `import { AccumulatorsSubTab } from "./accumulators/AccumulatorsSubTab"` */
const COMPONENT_IMPORT_PATTERN =
  /import\s*\{\s*(\w+)\s*\}\s*from\s*"(\.[^"]+)"/g

/** `subtab_search_member: MemberSearchSubTab,` */
const BINDING_PATTERN = /^\s*(subtab_[a-z0-9_]+)\s*:\s*(\w+)\s*,/gm

/**
 * A dotted path in backticks, e.g. `search.provider.results`.
 *
 * Deliberately conservative: starts lower-case, needs at least one dot, and
 * must be backtick-quoted. That picks up the authored data paths and leaves
 * prose, component names and import specifiers alone.
 */
const DATA_PATH_PATTERN = /`([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)`/g

/** Paths that are evidently not bundle data paths. */
const NOT_DATA_PATHS = new Set(["data.json", "ui.json", "pnpm.test"])

/**
 * Reject a candidate whose segment is purely numeric: `g47.00` is a diagnosis
 * code in a doc comment, not a data path.
 */
const hasNumericSegment = (path) =>
  path.split(".").some((segment) => /^\d+$/.test(segment))

function readComponentSource(mapPath, relativeImport) {
  const base = resolve(dirname(mapPath), relativeImport)
  for (const candidate of [`${base}.tsx`, `${base}.ts`]) {
    if (existsSync(candidate))
      return { path: candidate, source: readFileSync(candidate, "utf8") }
  }
  return null
}

/**
 * The sibling `*.types.ts` files in a component's directory.
 *
 * The data path is often documented on the Zod schema that narrows the authored
 * JSON rather than in the component itself, so both are read.
 */
function readSiblingTypes(componentPath) {
  const dir = dirname(componentPath)
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith(".types.ts"))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"))
}

function collectDataPaths(sources) {
  const paths = new Set()
  for (const source of sources) {
    for (const match of source.matchAll(DATA_PATH_PATTERN)) {
      const path = match[1]
      if (NOT_DATA_PATHS.has(path) || hasNumericSegment(path)) continue
      paths.add(path)
    }
  }
  return [...paths].sort()
}

/**
 * Parse v1's bespoke sub-tab map.
 *
 * Returns `{ bindings, components }` where `bindings` maps a sub-tab id to its
 * component name and the observed data-path candidates for it.
 */
export function extractBespokeMap(mapPath) {
  let mapSource
  try {
    mapSource = readFileSync(mapPath, "utf8")
  } catch (cause) {
    throw new BespokeMapError(
      `Cannot read v1's bespoke sub-tab map: ${mapPath}`,
      {
        cause,
      }
    )
  }

  const importedFrom = {}
  for (const match of mapSource.matchAll(COMPONENT_IMPORT_PATTERN)) {
    importedFrom[match[1]] = match[2]
  }

  const bindings = {}
  const components = {}

  for (const match of mapSource.matchAll(BINDING_PATTERN)) {
    const [, subTabId, componentName] = match

    if (!components[componentName]) {
      const relativeImport = importedFrom[componentName]
      if (!relativeImport) {
        throw new BespokeMapError(
          `v1's bespoke map binds ${subTabId} to ${componentName}, but that component is not ` +
            `imported in ${mapPath}. The map's shape changed — review design D7.`
        )
      }

      const component = readComponentSource(mapPath, relativeImport)
      if (!component) {
        throw new BespokeMapError(
          `Cannot find the source for bespoke component ${componentName} ` +
            `(imported as "${relativeImport}" from ${mapPath}).`
        )
      }

      components[componentName] = {
        name: componentName,
        sourcePath: component.path,
        // Observed candidates — see the module comment.
        dataPathCandidates: collectDataPaths([
          component.source,
          ...readSiblingTypes(component.path),
        ]),
      }
    }

    if (bindings[subTabId] && bindings[subTabId].component !== componentName) {
      throw new BespokeMapError(
        `v1's bespoke map binds ${subTabId} twice, to ${bindings[subTabId].component} ` +
          `and ${componentName}. Cannot tell which renders it.`
      )
    }

    bindings[subTabId] = { component: componentName }
  }

  if (Object.keys(bindings).length === 0) {
    throw new BespokeMapError(
      `Parsed no sub-tab bindings from ${mapPath}. The map's shape changed — review design D7.`
    )
  }

  return { bindings, components }
}

/**
 * Assert every binding reaches a sub-tab that the converted pack declares
 * (task 3.5, `v1-flow-conversion`).
 *
 * An unreachable binding means either the map or the flows moved on without the
 * other, and silently ignoring it would leave a sub-tab rendering from sections
 * when v1 rendered it with a component.
 */
export function assertBindingsReachable(bindings, declaredSubTabIds) {
  const unreachable = Object.keys(bindings)
    .filter((id) => !declaredSubTabIds.has(id))
    .sort()

  if (unreachable.length) {
    throw new BespokeMapError(
      `v1's bespoke map binds sub-tab ids that no converted bundle declares:\n` +
        unreachable.map((id) => `  - ${id}`).join("\n") +
        `\nThe binding is unreachable: either the flow was removed or the id changed.`
    )
  }
}
