import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useSystemStatus } from "../viewmodel/useSystemStatus"

/**
 * The view layer.
 *
 * Note what is NOT here (§39): no `fetch`, no import of `lib/api.ts`, no
 * decision about what the data means. It receives everything from its
 * viewmodel hook and renders the loading and error states that §39 makes
 * mandatory.
 */
export function SystemStatusCard() {
  const { health, loading, error, reload } = useSystemStatus()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>API status</CardTitle>
        <CardDescription>
          Reported by <code>GET /api/health</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : error ? (
          // The server's message, rendered verbatim — the client does not
          // compose its own explanation (§12).
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : health ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{health.status}</dd>
            <dt className="text-muted-foreground">Build</dt>
            <dd>{health.build}</dd>
            <dt className="text-muted-foreground">Uptime</dt>
            <dd>{health.uptimeSeconds}s</dd>
          </dl>
        ) : null}

        <Button variant="outline" size="sm" onClick={reload} className="w-fit">
          Refresh
        </Button>
      </CardContent>
    </Card>
  )
}
