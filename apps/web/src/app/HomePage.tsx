import { SystemStatusCard } from "@/features/system-status/view/SystemStatusCard"

/**
 * Placeholder home.
 *
 * §33 defines the real trainee home (assigned content, assessments, daily tips,
 * guides) and the program view that answers "Where am I? What's left? Why is it
 * locked?". Both need the program model, the progression engine and content,
 * none of which exists yet.
 *
 * What this page does do is prove the stack end to end: a view rendering a
 * viewmodel that reached the api through lib/api.ts.
 */
export function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Praxis v2</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The workspace is bootstrapped. No schema, authentication, content or
          trainee behaviour exists yet — see docs/SPEC.md §41 for the build
          order.
        </p>
      </div>
      <SystemStatusCard />
    </div>
  )
}
