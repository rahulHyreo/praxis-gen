# middleware/

Cross-cutting request handling. Order is part of the contract — `../server.ts`
registers these in the sequence `docs/SPEC.md` §38 prescribes, and several only
work in their stated position.

Present:

- `error.middleware.ts` — the single error handler and the `/api` 404. Both must
  be registered **last**, after every route: Express selects an error handler
  only from those registered after the middleware that threw, and identifies one
  by its four-parameter signature.

To come, each with its own change: `auth.middleware.ts` (`requireAuth`, then
`requireRole([...])` — §6), the audit middleware (§37), the request log (§37),
the mobile block (§7), and the response cache read/invalidate pair (§38).
