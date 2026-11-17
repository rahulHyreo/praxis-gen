# @workspace/ui

The shared design system: shadcn/ui primitives, the design tokens, and the two
hooks and one utility they depend on. `apps/web` consumes it as source through
the `exports` map — there is no build step.

`docs/SPEC.md` §39 fixes two things about this package:

- **shadcn/ui only.** Do not add a second component library or hand-roll a
  primitive that shadcn provides.
- **Design tokens are locked to the shadcn preset `b1aJCZWLY`.** The tokens live
  in `src/styles/globals.css`. Changing a token changes every screen, so treat
  that file as the design system's public API rather than a stylesheet.

## What is here

| Path                      | Contents                                              |
| ------------------------- | ----------------------------------------------------- |
| `src/components/`         | 46 components, each with a colocated `*.test.tsx`     |
| `src/lib/utils.ts`        | `cn()` — the `clsx` + `tailwind-merge` class combiner |
| `src/hooks/use-mobile.ts` | viewport breakpoint hook                              |
| `src/styles/globals.css`  | design tokens, light and dark                         |
| `src/test/`               | jsdom setup and a `render` helper                     |

These are **generated** shadcn components, carried over from Praxis v1 along
with their tests. They contain no domain vocabulary — no pack ever leaks into
this package (§Non-negotiables), and a guard test in `apps/api` enforces the
same rule for core services.

Four of them (`app-sidebar`, `nav-user`, `login-form`,
`hold-to-delete-button`) are shadcn registry _blocks_ rather than primitives, so
they ship with placeholder copy. The change that first renders one replaces that
copy; the component is the reusable part.

## Adding a component

```bash
pnpm --filter @workspace/ui exec shadcn add <component>
```

`components.json` already points the CLI at this package's paths, style
(`radix-luma`), base colour (`neutral`) and icon library (`hugeicons`), so the
generated file lands in `src/components/` wired to the right tokens.

Then add a test. Coverage here is a ratchet (§43): the floor in
`vitest.config.ts` only ever rises, so a component added without one lowers the
reading and fails the gate.

## Conventions

- `cn()` for every conditional class. Tailwind class conflicts resolve
  last-wins only through `tailwind-merge`; string concatenation silently keeps
  both.
- Components take `className` and spread the rest of their props, so a caller
  can extend them without a wrapper.
- Tests use Testing Library and query by role or label, not by class name.
  Several components here are Radix primitives whose rendered roles change
  between versions — `role="group"` became `role="radiogroup"` for
  single-select `ToggleGroup`, which is why this repository pins exact
  dependency versions (see the bootstrap change, decision D2).
