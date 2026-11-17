import { useCallback, useEffect, useState } from "react"

import { api, ApiRequestError } from "@/lib/api"
import { healthSchema, type Health } from "../model/schema"

/**
 * The viewmodel layer: the ONLY place that calls `lib/api.ts` (§39).
 *
 * It owns the three things every view needs and §39 makes mandatory — data,
 * `loading` and `error` — so a view never has to decide what "not loaded yet"
 * looks like.
 *
 * Tests mock `@/lib/api`, which is the whole point of routing every request
 * through one module: no network in a web test (§43).
 *
 * NOTE ON SHAPE. The effect sets state only from its async callbacks, never
 * synchronously in its body, and `reload()` does the synchronous reset itself.
 * That is not a style choice: `react-hooks/set-state-in-effect` rejects a
 * synchronous setState in an effect body, because it causes a second render
 * pass before paint. An event handler is the right place for it.
 */
export interface SystemStatus {
  health: Health | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSystemStatus(): SystemStatus {
  const [health, setHealth] = useState<Health | null>(null)
  // Starts true: the first render IS a load, so there is nothing for an effect
  // to announce.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    // Synchronous resets belong here, in the event handler, not in the effect.
    setLoading(true)
    setError(null)
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    // Guards against a late response from a previous run overwriting a newer
    // one, and against setting state after the component has unmounted.
    let active = true

    api
      .get<unknown>("/health")
      .then((raw) => {
        if (!active) return
        // Parse at the boundary: a shape change becomes one clear error here
        // rather than `undefined` in a view.
        setHealth(healthSchema.parse(raw))
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        // An ApiRequestError carries the server's own message, which for a
        // refusal is the reason §12 requires be rendered verbatim.
        setError(
          err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not reach the API."
        )
        setHealth(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadToken])

  return { health, loading, error, reload }
}
