# lib/

Small, dependency-light helpers with no business logic: things a service or
route needs that are not themselves a decision. Anything that decides belongs in
`../services/` (and is subject to the no-domain-names guard).

Present:

- `build-info.ts` — the build identity `/api/health` reports.
