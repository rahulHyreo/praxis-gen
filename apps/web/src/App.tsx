import { Toaster } from "@workspace/ui/components/sonner"

import { AppRouter } from "./app/router"

/**
 * Application root: the providers that wrap every route.
 *
 * Sonner is the toast system §39 fixes — one notification mechanism, not a
 * per-feature choice.
 *
 * Providers that arrive with later changes mount here: the theme provider, the
 * TanStack Query client, and the session/keepalive provider of §7.
 */
export function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  )
}

export default App
