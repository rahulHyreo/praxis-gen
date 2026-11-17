import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That route is not registered in <code>src/app/router.tsx</code>.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}
