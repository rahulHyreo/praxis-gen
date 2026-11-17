# routes/

One module per resource, each exporting an Express `Router`. Mounted in
`../server.ts`, which is the only place a route becomes reachable.

`docs/SPEC.md` §38 fixes the conventions:

- **Zod schema first.** Validate the body, query and params before touching a
  service. A `ZodError` thrown here becomes HTTP 422 with its issues in
  `details` — the error middleware does that centrally, so a route should let
  the error propagate rather than formatting its own 422.
- **Errors are thrown, not returned.** `express-async-errors` (the first import
  in `../server.ts`) forwards a rejected promise to the error handler. Throw an
  `ApiError` with a `status` to choose the response code.
- **Every response shape is `{ error, details?, code? }` on failure.** Shared
  error codes live in `@platform/shared`, because the web app branches on them.
- **Routes decide nothing.** Progression, eligibility, scoring, visibility and
  RBAC are service concerns (§6, §12). A route validates, calls a service, and
  serialises.
- **Answer keys never reach a trainee.** Any serialiser for a trainee-role
  response strips `randomization`, `mismatch`, `correctValue`, `expectedValue`,
  expected decisions, reference reasoning, assist correctness flags and MCQ
  correct options (§13, §24). A guard test will sweep these serialisers once
  there are any.

RBAC is applied as middleware — `requireAuth`, then `requireRole([...])` — not
inside a handler. The broad `/api/admin` router applies `requireRole(["admin"])`
at router level, and `/api/governance` applies `requireRole(["governance_admin"])`.
A hidden menu item is not access control.

Currently present: `health.ts`. The §38 routers still to come are
`/api/program`, `/api/progression`, `/api/reasoning`, `/api/dri`,
`/api/passport`, `/api/credentials`, `/api/governance/*`, `/api/admin/packs`,
`/api/admin/institutions`, `/api/admin/employers` and (phase 2)
`/api/public/credentials`.
