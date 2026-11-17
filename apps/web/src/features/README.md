# features/

One folder per feature, in **strict MVVM** (`docs/SPEC.md` §39):

```
features/<feature>/
  model/        Zod schemas + a Zustand store. No React, no fetch.
  viewmodel/    Hooks. The ONLY layer that calls `lib/api.ts`.
  view/         Components. Render what the viewmodel returns.
```

The rule that makes it worth having: **a view never calls `api.*`**, and never
imports from `lib/api.ts`. It takes data and callbacks from its viewmodel hook.
That is what lets a view be tested by rendering it and a viewmodel be tested by
mocking one module.

Two more §39 requirements, easy to forget and visible to users when missed:

- **Loading and error states are mandatory**, not optional polish. Every
  viewmodel exposes them and every view renders them.
- **The server's refusal reason is rendered verbatim** (§12). When the API says
  a block is locked and why, the UI shows that sentence — it does not compose
  its own. The reason is server-authoritative; a second copy in the client
  drifts.

Other conventions: shadcn/ui only (from `@workspace/ui`), Sonner for toasts,
routes registered in `src/app/router.tsx` and nowhere else, design tokens
untouched (§39 locks them to the shadcn preset `b1aJCZWLY`).

## The reference feature

`system-status/` is a complete, working example of the three layers, built on
the one endpoint that exists (`GET /api/health`). It is small on purpose — it
is here so the first real feature copies a shape that already works rather than
inventing one.

## Feature folders to come

§39 names them: `program`, `progression`, `reasoning`, `ai-assist`, `dri`,
`passport`, `credentials`, `governance`, `packs`, `institutions`, `employers`,
`overlay` — plus the v1 features the workbench and assessment phases port over.
Each arrives with its own change.
