import { Outlet } from "react-router-dom"

/**
 * The application shell: the chrome every route renders inside.
 *
 * Deliberately thin. The real shell — sidebar, topbar, role-aware navigation,
 * the ProctoredShell that §16 places around assessment runs — arrives with the
 * changes that have something to navigate to. What matters now is that the
 * nesting point exists, so a route added later lands inside a layout rather
 * than beside one.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <span className="font-semibold">Praxis</span>
          <span className="text-sm text-muted-foreground">
            healthcare-operations training &amp; certification
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
