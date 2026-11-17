> ## Reference only — not a v2 requirement source
>
> This is **Praxis v1's** specification, carried verbatim as the reference
> `docs/SPEC.md` §2 calls "the v1 SPEC". It is authoritative **only** for
> behaviour that `docs/SPEC.md` marks `[v1]`, and only until the corresponding
> v2 capability spec exists in `openspec/specs/`.
>
> Wherever `docs/SPEC.md` marks something `[changed]`, **`docs/SPEC.md` wins** and
> this document is simply describing the old behaviour. Anything marked `[new]`
> is absent here by definition. The full precedence order is: code →
> `docs/SPEC.md` → `openspec/specs/` → this document (`[v1]` items only) →
> design documents.
>
> **Two things to know before relying on a detail in here.**
>
> First, the file name. `docs/SPEC.md` §2 describes this as v1's
> `docs/SPEC.md`. No such file exists in the v1 repository — v1's authoritative
> specification is `docs/SDD-master-spec.md`, which is what this is a copy of.
> v1 also keeps deeper per-area documents that this one does not supersede
> (`docs/scoring-and-percentages.md`, `docs/database-schema.md`,
> `docs/SDD-assessment-scenario-mcq-admin-trainer.md`,
> `docs/SDD-trainee-assessment-experience.md`); consult the v1 repository
> directly when a carried engine's detail is not settled here.
>
> Second, v1's own warning about this document, from the v1 `CLAUDE.md`:
>
> > Note some numbers there have drifted from code (e.g. it says trainee IDs
> > are `HYTR-`; the code emits `HYTE-`). **When docs and code disagree, trust
> > the code.**
>
> That drift is real and this copy does not correct it. The trainee ID format is
> `HYTE-#####`, as `docs/SPEC.md` §40 and `packages/db/src/ids.ts` both have it.
> Treat any specific number here as a starting point to verify against the v1
> code, not as a fact.
>
> This is a point-in-time snapshot taken when the v2 repository was
> bootstrapped. It is not synced with the v1 repository and never will be.

---

# Training Platform — Spec-Driven Development (SDD) Master Document

# For AI Coding Assistants (Claude Code / Cursor / Copilot)

---

## HOW TO USE THIS DOCUMENT

This document is the **single source of truth** for the entire project.
Each task is written so an AI coding assistant can implement it **without
asking for clarification**. Work tasks in order — later tasks depend on
earlier ones. Each task references the exact files to create or modify,
the exact types to use, and the exact behaviour expected.

**Workflow per task:**

1. Read the task fully before writing any code
2. Check "Depends on" — do not start until those tasks are ✅
3. Write code that satisfies every bullet in "Acceptance criteria"
4. Run the validation command shown at the end of the task

---

## PROJECT PURPOSE

A **web-based claims processing training platform** used by insurance
companies to train claims adjusters. Trainees work through realistic
claim adjudication simulations before handling live claims.

**Three user roles:**

| Role        | What they do                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Admin**   | Create cohorts, manage trainers and trainees, build scenarios, manage MCQ bank, view reports |
| **Trainer** | Monitor their assigned cohorts, view trainee progress and leaderboard, export reports        |
| **Trainee** | Complete training flows, practice claim adjudication, take assessments                       |

**Core concept — the claim workspace:**
A fully dynamic, JSON-schema-driven form UI that simulates a real claims
adjudication system (tabs, sub-tabs, fields). Trainees navigate through
guided steps (Navigator) and submit an Accept/Decline decision. The
system records every tab visit, field interaction, step completion, and
timing event, then scores the attempt.

---

## TECH STACK (locked — do not change)

| Concern            | Library / Tool              |
| ------------------ | --------------------------- |
| Monorepo           | Turborepo                   |
| Frontend framework | React 19 + React Router v7  |
| Backend framework  | Express.js                  |
| ORM                | Drizzle ORM (PostgreSQL)    |
| Authentication     | Better Auth (email OTP)     |
| UI components      | shadcn/ui + Tailwind CSS v4 |
| State management   | Zustand                     |
| Form handling      | TanStack Form + Zod         |
| Tables             | TanStack Table v8           |
| Pattern            | MVVM per feature            |
| Exports            | SheetJS (xlsx)              |
| File upload        | react-dropzone + papaparse  |

---

## MONOREPO STRUCTURE (target)

```
/
├── apps/
│   ├── web/                      ← React frontend (Vite)
│   │   └── src/
│   │       ├── app/              ← Router, shell layout
│   │       ├── features/         ← One folder per domain (MVVM)
│   │       ├── components/       ← Shared UI components
│   │       └── lib/              ← API client, utils, hooks
│   └── api/                      ← Express backend
│       └── src/
│           ├── routes/           ← One file per domain
│           ├── middleware/       ← Auth, RBAC, error
│           └── services/         ← Business logic
├── packages/
│   ├── db/                       ← Drizzle schema + client + seed
│   └── shared/                   ← Zod schemas, types, constants
└── turbo.json
```

---

## MVVM CONVENTION (apply to every feature)

```
features/<domain>/
  model/
    <domain>.schema.ts      ← Zod schema + inferred TypeScript types
    <domain>.store.ts       ← Zustand store (state + actions)
  viewmodel/
    use<Domain>List.ts      ← TanStack Table wiring, search, pagination
    use<Domain>Form.ts      ← TanStack Form instance + submit handler
  view/
    <Domain>Page.tsx        ← Page component (imports only from viewmodel)
    <Domain>Table.tsx       ← Table render (uses TanStack Table)
    <Domain>Dialog.tsx      ← Create/edit modal
```

**Rule:** Views never call `api.*` directly. Views never import from `model/`.
All side effects live in the store or viewmodel.

---

---

# TASK GROUP 1 — MONOREPO & TOOLING

---

## TASK 1.1 — Initialise Turborepo monorepo

**Purpose:** Create the project skeleton so all subsequent tasks have a
consistent workspace.

**Files to create:**

- `turbo.json`
- `package.json` (root — workspaces)
- `apps/web/package.json`
- `apps/api/package.json`
- `packages/db/package.json`
- `packages/shared/package.json`
- `.env.example`
- `README.md`

**Exact turbo pipeline:**

```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "db:push": { "cache": false },
    "lint": {}
  }
}
```

**Root scripts:**

```json
{
  "dev": "turbo run dev",
  "build": "turbo run build",
  "db:push": "turbo run db:push --filter=@platform/db",
  "db:seed": "tsx packages/db/src/seed.ts"
}
```

**Environment variables required (.env.example):**

```
DATABASE_URL=postgresql://user:password@localhost:5432/training_platform
BETTER_AUTH_SECRET=change_me_32_chars_minimum
BETTER_AUTH_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
```

**Acceptance criteria:**

- `pnpm install` at root installs all workspaces without error
- `pnpm dev` starts both `apps/web` (port 5173) and `apps/api` (port 3001) concurrently
- TypeScript paths resolve across packages using `@platform/db` and `@platform/shared`

---

## TASK 1.2 — Configure shadcn/ui + Tailwind CSS v4

**Purpose:** Establish the design system foundation all UI components use.

**Files to create/modify:**

- `apps/web/tailwind.config.ts`
- `apps/web/src/index.css`
- `apps/web/components.json`

**CSS variables (paste exactly into `src/index.css` `:root`):**

```css
:root {
  --background: 0 0% 100%;
  --foreground: 36 8% 12%;
  --primary: 213 72% 37%;
  --primary-foreground: 0 0% 100%;
  --secondary: 47 14% 92%;
  --secondary-foreground: 36 8% 12%;
  --muted: 47 14% 92%;
  --muted-foreground: 36 4% 37%;
  --accent: 47 14% 92%;
  --destructive: 0 56% 40%;
  --destructive-foreground: 0 0% 100%;
  --border: 45 10% 83%;
  --input: 45 10% 83%;
  --ring: 213 72% 37%;
  --radius: 0.375rem;
}
```

**shadcn components to install (run in `apps/web`):**

```bash
npx shadcn@latest add alert alert-dialog avatar badge button calendar \
  card checkbox collapsible dialog dropdown-menu form input label \
  popover progress select separator sheet skeleton sonner table \
  tabs textarea tooltip
```

**Acceptance criteria:**

- `<Button>`, `<Card>`, `<Input>` render with the correct blue primary colour
- Dark mode classes auto-adapt via the CSS variable system
- No Tailwind purge warnings in dev

---

---

# TASK GROUP 2 — DATABASE

---

## TASK 2.1 — Drizzle schema

**Purpose:** Define every table, enum, relation, and inferred type for the
whole application.

**File:** `packages/db/src/schema.ts`

**Tables to implement (in dependency order):**

```
users
cohorts
trainers              → FK users
trainees              → FK cohorts, users
cohort_trainers       → FK cohorts, trainers  (junction, composite PK)
workspace_schemas     (jsonb schema column)
navigator_schemas     (jsonb schema column)
scenarios             → FK cohorts
sub_scenarios         → FK scenarios
flows                 → FK sub_scenarios, workspace_schemas, navigator_schemas
documents             → FK scenarios
claims                → FK flows
training_sessions     → FK cohorts, flows, scenarios, sub_scenarios
attendance            → FK training_sessions, trainees  (composite PK)
trainee_flows         → FK trainees, flows, cohorts  (unique on trainee+flow)
trainee_attempts      → FK trainees, claims, flows, cohorts
attempt_step_results  → FK trainee_attempts
attempt_tab_visits    → FK trainee_attempts
attempt_field_interactions → FK trainee_attempts
proxy_violations      → FK trainee_attempts
assessments           → FK cohorts
assessment_flows      → FK assessments, flows  (composite PK)
trainee_assessments   → FK trainees, assessments  (unique on trainee+assessment)
leaderboard_entries   → FK cohorts, trainees  (unique on cohort+trainee)
trainer_notes         → FK trainers, trainees, cohorts
daily_tips
report_exports        → FK users
```

**Enums to define:**

```
user_role:           admin | trainer | trainee
cohort_status:       draft | active | completed | archived
mode_of_training:    Offline | Online | Hybrid
person_status:       active | inactive
training_mode:       training | practice | assignment
flow_status:         not_started | in_progress | completed | passed | failed
progress_status:     not_started | on_track | at_risk | completed
claim_status:        not_started | in_progress | passed | failed
claim_decision:      accept | decline
attendance_status:   Present | Absent | Late
completion_status:   Not Started | In Progress | Completed
assessment_status:   upcoming | in_progress | completed
violation_severity:  warn | log | prevent | terminate
report_type:         cohort_level | attendance | training_completion | progress |
                     assessment_results | assessment_outcome
```

**Key field constraints:**

- `trainers.trainer_id` — unique, format `CRTR-XXXXX`
- `trainees.trainee_id` — unique, format `HYTR-XXXXX`
- `claims.dcn` — unique, format `DCN-XXXXXX`
- `claims.billed_amount` — `numeric(12,2)`
- `workspace_schemas.schema` — `jsonb`
- `navigator_schemas.schema` — `jsonb`
- `claims.workspace_data` — `jsonb` (pre-filled values)
- All tables have `created_at timestamp with timezone defaultNow()`
- All mutable tables have `updated_at timestamp with timezone`

**Index requirements:**

- Every FK column that will appear in a WHERE clause gets an index
- Unique indexes on: `users.email`, `trainers.email`, `trainees.email`,
  `trainers.trainer_id`, `trainees.trainee_id`, `claims.dcn`
- Composite unique: `trainee_flows(trainee_id, flow_id)`,
  `trainee_assessments(trainee_id, assessment_id)`,
  `leaderboard_entries(cohort_id, trainee_id)`

**Export everything as:**

```ts
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
// ... repeat for every table
```

**Acceptance criteria:**

- `pnpm db:push` applies all migrations with zero errors
- `drizzle-kit studio` shows all 23 tables with correct columns and types
- All relations defined so `db.query.cohorts.findMany({ with: { trainees: true } })` works

---

## TASK 2.2 — Database client + ID helpers

**Purpose:** Singleton DB connection and ID generation utilities.

**File:** `packages/db/src/client.ts`

```ts
// Singleton Pool + drizzle instance
// Export: db, DB type
```

**File:** `packages/db/src/ids.ts`

```ts
// formatTraineeId(seq: number): string   → "HYTR-00056"
// formatTrainerId(seq: number): string   → "CRTR-48213"
// formatDcn(seq: number): string         → "DCN-100245"
// Sequences managed by PostgreSQL CREATE SEQUENCE
```

**File:** `packages/db/src/seed.ts`

- 1 admin user (Rahul Jayakumar)
- 2 cohorts (Cohort 2026-A active, Cohort 2026-B draft)
- 2 trainers with user accounts
- 5 trainees assigned to cohorts
- 1 full scenario tree (scenario → 2 sub-scenarios → 2 flows each)
- 1 workspace schema JSON (full Coverage Termination schema)
- 1 navigator schema JSON (9 steps)
- 3 claims (one per flow, with pre-filled workspace data)
- 1 upcoming assessment + 2 completed assessments
- 5 daily tips
- Leaderboard entries for all trainees

**Acceptance criteria:**

- `pnpm db:seed` completes with "✅ Seed complete"
- All foreign key constraints satisfied (no seed errors)
- `formatTraineeId(56)` returns `"HYTR-00056"` exactly

---

---

# TASK GROUP 3 — AUTHENTICATION

---

## TASK 3.1 — Better Auth server setup

**Purpose:** Configure email OTP authentication on the Express API.

**File:** `apps/api/src/lib/auth.ts`

**Configuration:**

```ts
import { betterAuth } from "better-auth"
import { emailOTP }   from "better-auth/plugins"

export const auth = betterAuth({
  database: { ... },          // drizzle adapter
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,         // 5 minutes
      sendVerificationOTP: async ({ email, otp }) => {
        // TODO: console.log in dev, real email in prod
        console.log(`OTP for ${email}: ${otp}`)
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 8,  // 8 hours
    cookieName: "tp_session",
  },
})
```

**File:** `apps/api/src/middleware/auth.middleware.ts`

```ts
// requireAuth — attaches req.user from session cookie, returns 401 if absent
// requireRole(roles: UserRole[]) — returns 403 if user.role not in list
// Both middleware functions exported
```

**Routes to mount on Express:**

- `POST /api/auth/send-otp` → calls `auth.sendOTP`
- `POST /api/auth/verify-otp` → calls `auth.verifyOTP`, sets session cookie
- `POST /api/auth/logout` → clears session
- `GET  /api/auth/me` → returns `req.user` (protected)

**Acceptance criteria:**

- `POST /api/auth/send-otp { "email": "test@example.com" }` → `{ "success": true }`
- Console shows the OTP in development
- `POST /api/auth/verify-otp { "email": "...", "otp": "123456" }` → sets `tp_session` cookie
- `GET /api/auth/me` with valid cookie → returns user object
- `GET /api/auth/me` without cookie → 401

---

## TASK 3.2 — Login page (React)

**Purpose:** Two-step email → OTP login screen.

**Files:**

- `apps/web/src/features/auth/view/LoginPage.tsx`
- `apps/web/src/features/auth/viewmodel/useLoginForm.ts`
- `apps/web/src/features/auth/model/auth.schema.ts`

**Step 1 — Email entry:**

- `Card` centred on page, 400px wide
- Platform logo above card
- `Input type="email"` with label "Email address"
- `Button` "Continue →" full width, calls `sendOtp(email)`
- Loading spinner on button during request
- `Alert variant="destructive"` shows API errors

**Step 2 — OTP entry (shown after email submitted):**

- Text: `"Enter the 6-digit code sent to {email}"`
- `InputOTP` with 6 `InputOTPSlot` components
- Auto-submits when all 6 digits entered
- "Resend code" button with 60s cooldown timer countdown
- `Alert` for invalid/expired OTP errors

**ViewModel state:**

```ts
type LoginStep = "email" | "otp"
// state: step, email, otp, isLoading, error, resendCooldown
// actions: submitEmail(), submitOtp(), resendOtp()
// On success: navigate to "/" and store user in useAuthStore
```

**Zod schema:**

```ts
emailSchema = z.object({ email: z.string().email() })
otpSchema = z.object({ otp: z.string().length(6) })
```

**Acceptance criteria:**

- User can log in end-to-end with valid email + OTP
- Invalid OTP shows red alert "Invalid or expired code"
- Resend button disabled for exactly 60s then re-enables
- After login, user lands on `"/"` which redirects based on role

---

## TASK 3.3 — Auth store + route protection

**Purpose:** Global auth state and role-based route guards.

**File:** `apps/web/src/lib/auth.store.ts`

```ts
// useAuthStore: Zustand store
// state: user (User | null), isLoading
// actions: fetchMe(), logout(), setUser()
// Persisted to sessionStorage
```

**File:** `apps/web/src/app/RoleGuard.tsx`

```ts
// Props: roles: UserRole[]
// If !user → <Navigate to="/login" />
// If user.role not in roles → <Navigate to="/unauthorized" />
// Otherwise → <Outlet />
```

**File:** `apps/web/src/app/AuthShell.tsx`

```ts
// Calls fetchMe() on mount
// Shows full-page skeleton while loading
// Renders children once resolved
```

**Router role mapping:**

```
/login                → public
/                     → redirect based on role
/cohorts              → admin + trainer (different views)
/cohorts/:id          → trainer + admin
/trainees             → admin
/trainers             → admin
/leaderboard          → trainer
/reports              → trainer
/home                 → trainee
/training             → trainee
/training/claims/:id  → trainee
```

**Acceptance criteria:**

- Navigating to `/trainees` while logged in as trainer → redirect to `/unauthorized`
- Refreshing the page while logged in keeps the user logged in (session cookie)
- `logout()` clears session cookie and redirects to `/login`

---

---

# TASK GROUP 4 — GLOBAL SHELL

---

## TASK 4.1 — Shell layout

**Purpose:** Topbar + sidebar that wraps all authenticated pages.

**File:** `apps/web/src/app/ShellLayout.tsx`

**Topbar (h-14, border-bottom):**

- Left: Platform logo SVG + current page title from route meta
- Right: `<BookOpen>` icon button (tooltip "Platform Guide"),
  `<Avatar>` with initials, user name, role `<Badge>`

**Sidebar (w-14, border-right, icon-only):**

- Nav items defined by `navConfig[user.role]` (see below)
- Active item: `bg-primary/10 text-primary`
- Each icon wrapped in shadcn `<Tooltip side="right">` showing label
- Logo at the top (clickable, goes to home)

**navConfig by role:**

```ts
const navConfig = {
  admin: [
    { icon: GraduationCap, label: "Cohorts", href: "/cohorts" },
    { icon: Users, label: "Trainees", href: "/trainees" },
    { icon: UserCheck, label: "Trainers", href: "/trainers" },
  ],
  trainer: [
    { icon: GraduationCap, label: "My Cohorts", href: "/cohorts" },
    { icon: Trophy, label: "Leaderboard", href: "/leaderboard" },
    { icon: FileText, label: "Reports", href: "/reports" },
  ],
  trainee: [
    { icon: Home, label: "Home", href: "/home" },
    { icon: Dumbbell, label: "Training", href: "/training" },
  ],
}
```

**Acceptance criteria:**

- Sidebar shows correct items for each role — admin never sees Leaderboard
- Active route item highlighted
- Topbar shows correct user name and role badge
- Layout is responsive — sidebar collapses gracefully at ≤768px

---

---

# TASK GROUP 5 — ADMIN FEATURES

---

## TASK 5.1 — Cohorts list page (Admin)

**Purpose:** Admin's home page showing all cohorts with lifecycle actions.

**Files:**

```
features/cohorts/
  model/
    cohort.schema.ts
    cohort.store.ts
  viewmodel/
    useCohortList.ts
  view/
    AdminCohortPage.tsx
    CohortTable.tsx
    CohortCreateDialog.tsx
    CohortActions.tsx
```

**Page header:**

- Title "Cohorts", subtitle "Create cohorts and lock in their scenario assignments."
- `<Button>` "+ New cohort" top-right, opens create dialog

**Table columns (TanStack Table):**

| Column   | Cell content                       |
| -------- | ---------------------------------- |
| Name     | `<span className="font-semibold">` |
| Start    | formatted date `yyyy-MM-dd`        |
| Trainers | comma-joined trainer names         |
| Trainees | `enrolled/capacity`                |
| Status   | `<StatusBadge>`                    |
| Actions  | `<CohortActions cohort={row}>`     |

**StatusBadge variants:**

```ts
active:    green-50 bg / green-200 border / green-700 text
draft:     gray-50 / gray-200 / gray-600
completed: blue-50 / blue-200 / blue-700
archived:  amber-50 / amber-200 / amber-700
```

**CohortActions — conditional by status:**

```
draft     → [▶ Activate] [✏ Edit] [🗑 Delete]
active    → [⊙ Complete] [Archive]
completed → [Archive]
archived  → (nothing)
```

- Delete opens `<AlertDialog>` confirmation before calling store
- All actions call store methods that PATCH `/api/cohorts/:id/status`

**Search:** `<Input>` debounced 300ms, filters `table.setGlobalFilter()`

**Pagination:** `<DataTablePagination>` with page size selector [10, 25, 50]

**Empty state:** `<GraduationCap>` icon + "No cohorts yet" + "+ New cohort" button

**Create Cohort Dialog — TanStack Form + Zod:**

Fields:

```
cohort_name*        text input
start_date*         Calendar popover (dd/mm/yyyy display)
duration_weeks      number input (default: 8)
capacity            number input (default: 200)
mode_of_training    Select: Offline | Online | Hybrid
description         Textarea (3 rows)
trainer_ids*        Scrollable checkbox list of all trainers
                    Shows name + (email) per row
                    Min 1 trainer required
```

Zod schema:

```ts
z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  durationWeeks: z.coerce.number().int().min(1).default(8),
  capacity: z.coerce.number().int().min(1).default(200),
  modeOfTraining: z.enum(["Offline", "Online", "Hybrid"]),
  description: z.string().optional(),
  trainerIds: z.array(z.string().uuid()).min(1),
})
```

**Acceptance criteria:**

- Create form validates all required fields before submit
- Start date picker shows calendar, stores ISO date string
- Trainer checkbox list loads from `GET /api/trainers`
- Creating cohort closes dialog and adds row to table without page reload
- Status transition buttons call correct endpoints and update row in place

---

## TASK 5.2 — Trainees page (Admin)

**Purpose:** List, create, and bulk-import trainee records.

**Files:**

```
features/trainees/
  model/  viewmodel/  view/
  TraineesPage.tsx  TraineeTable.tsx
  TraineeCreateDialog.tsx  BulkUploadDialog.tsx
```

**Table columns:**

```
Trainee ID   font-mono text-xs text-muted-foreground
Name         font-semibold
Email        text-sm text-muted-foreground
Cohort       cohort name
Status       inline Select dropdown (active | inactive) — saves on change
Actions      Trash icon → AlertDialog confirm → DELETE /api/trainees/:id
```

**Status inline edit:**

```tsx
<Select value={trainee.status} onValueChange={v => updateStatus(trainee.id, v)}>
  <SelectTrigger className="h-8 w-28 text-xs">
```

Calls `PATCH /api/trainees/:id/status`

**Create Trainee Dialog fields:**

```
Trainee ID      readonly, placeholder "Auto-generated"
Name*           text
Email*          email
Phone           text
Location        text
Cohort          Select — shows only DRAFT cohorts
```

**Bulk Upload Dialog:**

- Two controls at top: "Default team" text input, "Default cohort" Select
- Drag-and-drop zone using `react-dropzone` (accepts `.csv` only)
- "Download template" button — triggers download of CSV with headers:
  `trainee_id,name,email,phone,location,cohort_id,status`
- Parse with `papaparse` on drop; validate each row with Zod
- Show: green Alert "N valid rows ready" + red Alert "N rows have errors"
- Errors collapsible: show row number + field + message
- "Import valid rows" sends POST `/api/trainees/bulk`

**Acceptance criteria:**

- Auto-generated trainee ID displayed after creation (format HYTR-XXXXX)
- Bulk upload accepts 100-row CSV, imports valid rows, reports errors
- Status dropdown saves immediately on change (no save button)
- Search filters Name, Email, Trainee ID columns

---

## TASK 5.3 — Trainers page (Admin)

**Purpose:** List and create trainer records (trainer creation also creates login account).

**Files:**

```
features/trainers/
  model/  viewmodel/  view/
  TrainersPage.tsx  TrainerTable.tsx  TrainerCreateDialog.tsx
```

**Table columns:**

```
Trainer ID    font-mono
Name          font-semibold + "+N" badge if assigned to >1 cohort
              Tooltip on badge: "Assigned to N cohorts"
Email
Cohort        primary cohort name
Status        inline Select (active | inactive)
Actions       Trash → confirm delete
```

**"+N" multi-cohort badge:**

```tsx
{
  trainer.cohortCount > 1 && (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="secondary" className="text-xs">
          +{trainer.cohortCount - 1}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Assigned to {trainer.cohortCount} cohorts</TooltipContent>
    </Tooltip>
  )
}
```

**Create Trainer Dialog fields:**

```
Name*           text
Employee ID*    text (unique, stored in trainers.employee_id)
Email*          email (unique — also becomes login email)
Phone           text (optional)
```

**Post-create server behaviour:**

1. Insert into `trainers`
2. Insert into `users` with `role: "trainer"`, `email` from form
3. Send OTP invite email to trainer (or log in dev)
4. Return `{ trainerId, traineeId, userCreated: true }`

**Acceptance criteria:**

- Trainer ID auto-generated (CRTR-XXXXX format)
- Creating a trainer also creates a `users` row visible in DB
- Employee ID uniqueness validated server-side (409 Conflict on duplicate)
- "+2" badge shows on trainer assigned to 3 cohorts

---

---

# TASK GROUP 6 — TRAINER FEATURES

---

## TASK 6.1 — My Cohorts page (Trainer)

**Purpose:** Trainer's home screen showing only their assigned cohorts.

**Files:**

```
features/trainer-cohorts/
  model/  viewmodel/useTrainerCohortList.ts  view/TrainerCohortPage.tsx
```

**Route:** `/cohorts` — same path as admin, different component selected by role in router

**Table columns (different from admin's cohort table):**

```
Name          font-semibold, entire row is clickable
Team          text-muted-foreground
Avg Score     tabular-nums (— if no attempts yet)
Completion    tabular-nums + %
Trainees      enrolled/capacity
Status        StatusBadge
Actions       [View] button (ghost with Archive icon)
```

**Row click:** Entire `<TableRow>` has `onClick={() => navigate("/cohorts/${id}")}`

**Data source:** `GET /api/trainers/{trainerId}/cohorts`
Returns cohorts joined with aggregate stats:
`{ id, name, teamName, status, startDate, enrolled, capacity, avgScore, completionPct }`

**Empty state:** GraduationCap icon + "No cohorts assigned" + "Contact your administrator..."

**No create button** — trainers cannot create cohorts.

**Acceptance criteria:**

- Only cohorts where `cohort_trainers.trainer_id = current trainer` appear
- Avg Score shows "—" if `traineeAttempts` count is 0
- Clicking any part of a row navigates to `/cohorts/:id`

---

## TASK 6.2 — Cohort Detail page (Trainer)

**Purpose:** Detailed view of one cohort: KPI cards + trainee progress table.

**Files:**

```
features/trainer-cohorts/
  viewmodel/useCohortDetail.ts
  view/CohortDetailPage.tsx
    KpiCards.tsx
    TraineeProgressTable.tsx
    NoteDialog.tsx
```

**Route:** `/cohorts/:cohortId`

**Page header:**

- Back button `← Back to My Cohorts`
- `<h1>` = cohort name
- Subtitle = `"{teamName} · started {startDate}"`

**KPI Cards (grid-cols-5, shadcn Card):**

```
Enrolled    completed    Completion %    Avg Score    Attended
  5             0           41%             70          8/15
```

Data from: `GET /api/cohorts/:id/stats`

**Filter bar (above table):**

```tsx
[Search trainee...]  [All statuses ▼]  [Sort: Name ▼]
```

Status options: All statuses | On track | At risk | Completed
Sort options: Name | Progress | Score | Last activity
All filtering/sorting done **client-side** with `useMemo`

**Table columns:**

```
Trainee ID    font-mono text-xs muted
Name          font-semibold
Progress      <Progress className="h-1.5 w-16" value={pct}> + "42%"
Score         two-line: currentScore on top / maxScore below (muted)
Last Activity dd/MM/yyyy format
Status        <ProgressStatusBadge> (On track=green | At risk=red | Completed=blue)
Actions       <MessageSquare> icon → NoteDialog
```

**ProgressStatusBadge:**

```ts
on_track:  green-50 bg / green-200 border / green-700 text
at_risk:   red-50 / red-200 / red-600
completed: blue-50 / blue-200 / blue-700
not_started: gray-50 / gray-200 / gray-600
```

**At-risk logic (server-side):**
`progressStatus = "at_risk"` when:

- `lastActivityAt` > 7 days ago AND cohort started > 14 days ago, OR
- `progressPct < 20` AND cohort started > 14 days ago

**NoteDialog:**

```tsx
<Dialog>
  <DialogTitle>Add note for {trainee.name}</DialogTitle>
  <Textarea rows={4} />
  <Button>Save note</Button> // POST /api/trainer-notes
</Dialog>
```

**Acceptance criteria:**

- KPI cards update if attempt data changes (re-fetch on focus)
- Search filters both name and trainee ID
- Progress bar uses shadcn `<Progress>` at 6px height (`h-1.5`)
- Note saved shows toast "Note saved"

---

## TASK 6.3 — Leaderboard page (Trainer)

**Purpose:** Ranked leaderboard of trainees in a selected cohort.

**Files:**

```
features/leaderboard/
  model/leaderboard.schema.ts
  viewmodel/useLeaderboard.ts
  view/LeaderboardPage.tsx  LeaderboardTable.tsx
```

**Route:** `/leaderboard`

**Page header:** Title "Leaderboard", subtitle "Ranked by completion %, score, with attempt penalties."

**Cohort selector:**

```tsx
<Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
// Populated from trainer's assigned cohorts
// Auto-selects first cohort on load
```

**Table columns:**

```
#        RankCell — trophy icon for top 3 + rank number
Trainee  two-line: name (font-semibold) / traineeId (font-mono muted text-xs)
Completion  tabular-nums + %
Score    tabular-nums font-medium
Attempts tabular-nums muted
Total    tabular-nums font-semibold
```

**RankCell trophy colours:**

```
Rank 1: Trophy icon text-yellow-500, number text-yellow-600
Rank 2: Trophy icon text-slate-400, number text-slate-500
Rank 3: Trophy icon text-amber-600, number text-amber-700
Rank 4+: no icon, number text-muted-foreground
```

**Row highlight for top 3:**

```tsx
rank === 1 && "bg-yellow-50/50"
rank === 2 && "bg-slate-50/50"
rank === 3 && "bg-amber-50/50"
```

**Ranking formula (computed server-side, stored in `leaderboard_entries.total_score`):**

```ts
total = Math.round(
  completionPct * 0.4 + avgScore * 0.6 - Math.max(0, attempts - 1) * 5
)
```

**Empty state (no cohort selected):**
Trophy icon + "Select a cohort to see the leaderboard"

**API:** `GET /api/cohorts/:id/leaderboard` → `LeaderboardEntry[]` sorted by total DESC

**Acceptance criteria:**

- Leaderboard auto-loads for first cohort on page mount
- Changing cohort dropdown refreshes data
- Total score matches formula exactly
- Top 3 rows have distinct background tints

---

## TASK 6.4 — Reports page (Trainer)

**Purpose:** Filter and export four types of Excel reports.

**Files:**

```
features/reports/
  model/reports.schema.ts
  viewmodel/useReports.ts
  view/ReportsPage.tsx  ReportCard.tsx  ReportFilterBar.tsx
```

**Route:** `/reports`

**Filter bar (Card with grid-cols-4):**

```
Cohort selector    → trainer's cohorts + "All cohorts"
Status filter      → All | Active | Completed | Inactive
From date          → Calendar popover
To date            → Calendar popover (disabled dates before "From")
```

**Report cards (grid-cols-2, 2×2 layout):**

Each `<ReportCard>` shows:

- Title + description
- Column preview chips using `<Badge variant="secondary">` (font-normal, small)
- "↓ Export Excel" button (full width, primary)
- Loading: `<Loader2 className="animate-spin">` + "Exporting..."

**5 report types.** Every score and duration is measured on **Practice** (the
unaided run, without the Navigator) and read from the same functions the app
screens use; Training appears only as an attempt count. Flow-based reports count
only content **published to trainees** (`scenarios.audience` and
`flows.audience` = `everyone`, PRAXIS-415). Column manifests are locked in
`apps/web/src/features/reports/model/exportReport.ts`; when this list and the
code disagree, trust the code.

### 1. Cohort-Level Report

Columns: `Cohort Name`, `Total Enrollment`, `Completed`, `Avg Best Score`,
`Avg Assessment Score`, `Average Duration per Flow`, `Pass Rate (%)`,
`Completion Rate (%)`, `Attendance Rate (%)`, `At-Risk Count`, `Avg MCQ Score`,
`Avg Claim Score`, `Training Start`, `Training End`,
`No Of Assessments Conducted`, `Primary Trainer Name`
Grain: 1 row per cohort
Basis: `Avg Best Score` is the cohort page's "Avg Score" tile (mean of the
trainees' Practice-only Avg Best Score); `Avg Assessment Score` is the mean of
completed sessions' stored Total Score; `Average Duration per Flow` is the mean
Practice duration on published flows.

### 2. Attendance Report

Columns: `Trainee Name`, `Trainee ID`, `Email`, `Cohort Name`, `Present`,
`Absent`, `Total`, `Attendance %`, `Last Attended Date`
Grain: 1 row per trainee
Basis: absence is derived from expected Monday–Friday days, not stored rows.

### 3. Flow Mastery (Training Completion) Report

Columns: `Trainee Name`, `Trainee ID`, `Cohort Name`, `Total Flows`,
`Flows Completed`, `Completion %`, `In-Progress Count`, `Not-Started Count`,
`Avg Best Score`, `Last Activity Date`
Grain: 1 row per trainee
Basis: `Total Flows`, `Flows Completed`, `Completion %` and `Avg Best Score` come
from `computeCohortProgress`, so they equal the cohort's Trainee Progress table
(Flows Aced %, Avg Best Score).

### 4. Progress Report

Columns: `Trainee Name`, `Scenario Name`, `Sub-scenario`, `Flow`,
`Training Attempts`, `Practice Attempts`, `Successful Practice Attempts`,
`Practice Success Rate (%)`, `Average Duration`, `Best Duration`, `Best Score`,
`Latest Score`, `Assessment Time Taken`, `Navigator Step Score`, `MCQ Score`,
`Completion Status`, `Last Attempt Date`
Grain: 1 row per trainee × published flow
Basis: Training is reported as an attempt count only; every other attempt,
score, duration and navigator column counts Practice attempts only, matching
the trainee's Training page and Attempt History (PRAXIS-412).

### 5. Assessment Results Report

Columns: `Assessment Name`, `Cohort`, `Trainee Name`, `Trainee ID`, `Email`,
`Attempt`, `Status`, `MCQ Score`, `MCQ Correct`, `MCQ Incorrect`, `MCQ Skipped`,
`Claim Score`, `Claims Passed`, `Claims Incorrect`, `Total Score`,
`Proficiency Mark`, `At Or Above Mark`, `Total Duration`, `MCQ Duration`,
`Started At`, `Completed At`, `Ended Early`, `Recording Status`,
`Recording Path`
Grain: 1 row per assessment session; the only report that honours the date
range (on `completed_at`).

### 6. Assessment Outcome Report

Chosen by assessment **name** (`?assessmentName=`, required): every conducted
root assessment of that name in the cohort scope, each with the retests linked
to it through `retest_of_assessment_id`. The workbook has a `Summary` sheet (one
column per cohort, plus `Total` for two or more), one sheet per cohort, and a
`Needs follow-up` sheet (Final Result `Failed`, `Not submitted` or `Absent`).

Columns (per cohort sheet): `S.No`, `Trainee Name`, `Trainee ID`, `Email`,
`Attempts`, `Main Exam Total %`, `Main Exam Result`, `Retest Total %`,
`Retest Result`, `Final MCQ %`, `Final Claim %`, `Final Total Score %`,
`Final Result`, `Final Time Taken`, `Remarks`
Grain: 1 row per trainee enrolled in the assessment or one of its retests.
Basis: the main exam is the first sitting of the original assessment, the retest
the latest later sitting, and the final columns the **last** sitting. A sitting
passes when `total_score >= pass_mark` of that session. Summary rows: enrolled,
attempted, started-not-submitted, absent, passed / failed in the main exam,
attended retest, passed after retest, FINAL passed / failed, main exam and final
pass rates (% of those who sat), and average / highest / lowest final score.
Spec: `openspec/specs/assessment-outcome-report/spec.md`.

**Trainer digest (scheduled email):** per cohort, "Avg flows aced" and "Avg best
score" repeat the cohort page's Avg Flow Aced % and Avg Score tiles; top
performers are the first three of the live leaderboard (`computeLeaderboard`),
shown with their Weighted Total.

**Export logic (SheetJS):**

```ts
const ws = XLSX.utils.json_to_sheet(data.rows)
// Auto-column width:
ws["!cols"] = headers.map((h) => ({
  wch: Math.max(h.length, ...rows.map((r) => String(r[h] ?? "").length)) + 2,
}))
XLSX.writeFile(wb, `${filename}_${format(new Date(), "yyyyMMdd")}.xlsx`)
```

**Duration formatting:** seconds → `"mm:ss"` (e.g. 1123s → `"18:43"`)

**Acceptance criteria:**

- Each export button generates a real `.xlsx` file that opens in Excel
- Columns auto-sized so no truncation
- "—" used for null/missing values (not blank cells)
- Date range filter correctly applied to session/completion dates on server

---

---

# TASK GROUP 7 — TRAINEE FEATURES

---

## TASK 7.1 — Dashboard / Home page (Trainee)

**Purpose:** Trainee's landing page with progress overview, leaderboard, and assessments.

**Files:**

```
features/trainee-home/
  model/home.schema.ts
  viewmodel/useTraineeHome.ts
  view/TraineeHomePage.tsx
```

**Route:** `/home`

**Sections (top to bottom):**

### Welcome + Resume Card

```tsx
<Card className="mb-6 border-l-4 border-l-primary bg-primary/5">
  <p className="text-xs font-semibold text-primary uppercase">WELCOME BACK</p>
  <h1>"Hi, {user.name}"</h1>
  <p>subtitle text</p>
  <Button onClick={() => navigate("/training")}>Continue training →</Button>
</Card>
```

### How This Application Works (3 phase cards, grid-cols-3)

Phase 1 — Training: "Walk through every flow with the right-side guided navigation."
Phase 2 — Practice: "Re-run flows without guidance." (button disabled, "Coming soon")
Phase 3 — Assessment: "Bi-weekly evaluation..." → "View assessments" anchor

Each card has a top coloured border accent:

- Training: `border-t-4 border-t-blue-400`
- Practice: `border-t-4 border-t-yellow-400`
- Assessment: `border-t-4 border-t-green-400`

### KPI Info Cards (grid-cols-4)

```
Your cohort     → cohortName + "Started {date}"
Your trainer    → trainerName + email link + phone
Your details    → name + "Claims Trainee" + employeeId + email
Your rank       → Trophy icon + "#{rank} of {total}" + "{points} pts · top {pct}%"
```

### Your Progress + Cohort Leaderboard (2/3 + 1/3 split)

**Progress card:**

- "Overall" row with `{completedFlows}/{totalFlows} flows · {pct}%` + Progress bar
- Three mini-stat boxes: Scenarios `0/2`, Sub-scenarios `0/3`, Flows `0/4`
- Per-scenario breakdown rows: name + `{flows} · {pct}%`

**Leaderboard card:**

- Top 6 trainees in cohort
- Current user's row highlighted: `bg-primary/10`, name `text-primary`, score `font-bold`

### Assessments + Today's Tip (2/3 + 1/3 split)

**Assessments card:**

- UPCOMING section: Clock icon + name + date + "N flows"
- COMPLETED section: CheckCircle (green) icon + name + date + "score N%"

**Today's Tip card:**

- `bg-yellow-50 border-yellow-200`
- Lightbulb icon + "Today's tip" + category text + tip content
- Tip selected by server based on `activeOn = today` or random rotation

**API calls (all in parallel on mount):**

```
GET /api/trainees/me/home
→ { cohort, trainer, rank, progress, leaderboard, assessments, tip }
```

**Acceptance criteria:**

- All sections render with skeleton loaders while fetching
- Current user highlighted in leaderboard with blue background
- Progress percentages correct (0% when no flows completed)
- Assessment list shows upcoming first, then completed newest-first

---

## TASK 7.2 — Training page (scenario tree + right panel)

**Purpose:** Left-panel scenario/sub-scenario/flow navigation + right panel
showing video, claims, and docs for the selected scenario.

**Files:**

```
features/training/
  model/training.schema.ts  training.store.ts
  viewmodel/useTraining.ts
  view/TrainingPage.tsx  ScenarioCard.tsx  ClaimsTable.tsx
```

**Route:** `/training`

**Layout:** Two-panel, `flex h-[calc(100vh-56px)]`

**Left panel (w-[300px] border-r overflow-y-auto p-4):**

Label "SCENARIOS" (uppercase, text-xs muted)

Each `<ScenarioCard>` shows:

- Scenario name (font-semibold) + orange dot if any flow `in_progress`
- "Started: {date}" + "{completedFlows}/{totalFlows} flows · {pct}%"
- When selected: shows sub-scenario accordion using `<Collapsible>`
- Sub-scenario header with `<ChevronDown>` + name
- Flow buttons inside: active flow = `text-primary font-medium`

State: `selectedScenarioId` and `selectedFlowId` in Zustand store

**Right panel (flex-1 overflow-y-auto p-6):**
Three sections, labelled with uppercase `text-xs` headings:

### VIDEO SUMMARY

```tsx
<div className="flex gap-4 rounded-xl border p-4">
  {/* Thumbnail 220px wide with play button overlay */}
  {/* Description + Watch video btn + Mark as completed btn */}
</div>
```

"Mark as completed" calls `POST /api/trainee-flows/:id/mark-video-complete`

### CLAIMS

shadcn Table with columns: DCN | Patient | Service Date | Billed | Status | Attempts | Action

Status badges:

```
not_started: "Not started" gray badge
in_progress: "In progress" amber badge
passed:      "Passed"      green badge + check icon
failed:      "Failed"      red badge
```

Action button:

- `attempts === 0` → "Start" (primary)
- `attempts > 0 && !passed` → "Retry" (outline)
- `passed` → "Review" (ghost)

Button calls `navigate("/training/claims/${claimId}?mode=training")`

### DOCS

Each doc row: FileText icon + doc name + "Download" button
`onClick={() => window.open(doc.url, "_blank")}`

**Acceptance criteria:**

- Selecting a scenario updates right panel immediately (no loading flash for cached data)
- Clicking a flow scrolls it into view and selects it
- Claims table shows correct attempt count from `trainee_flows` data
- "Start" button disabled if claim has `maxAttempts` reached

---

## TASK 7.3 — Claim workspace — shell and tab renderer

**Purpose:** The dynamic JSON-schema-driven claim adjudication UI.

**Files:**

```
features/training/
  view/ClaimWorkspacePage.tsx
  view/workspace/WorkspaceRenderer.tsx
  view/workspace/TabContentRenderer.tsx
  view/workspace/SectionRenderer.tsx
  view/workspace/FieldRenderer.tsx
  view/workspace/ClaimLinesTable.tsx
```

**Route:** `/training/claims/:claimId?mode=training|assignment`

**Full page layout:**

```
[TopBar]           h-14 border-b
[ClaimHeader]      border-b, 4-column info row
[TabBar]           border-b, tabs from schema
[Content Area]     flex-1 overflow-y-auto
[Navigator Panel]  w-[320px] border-l  (hidden in assignment mode)
```

**TopBar:**

- `← Back to claims` ghost button
- Centre: `{scenario.name} · {flow.name}` in primary uppercase text
- Right: mode badge + "Submit decision" primary button

**ClaimHeader (4 columns):**

```
PATIENT        SERVICE DATE    BILLED AMOUNT    ATTEMPT #
Maria Lopez    2026-03-12      $1,240.50         1
```

**Tab rendering from JSON schema:**

```ts
schema.tabs.map(tab => (
  <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
))
```

On tab change: `navigatorStore.recordTabVisit(tabId)`

**Rendering logic by `tab.renderType`:**

```
undefined / "sections"  → <SectionRenderer>
"repeating_table"       → <ClaimLinesTable>
"sub_tabs"              → nested <Tabs> with sub-tab content
```

**SectionRenderer:**

- Renders each section as a Card with collapsible header
- Inside: `grid` with `grid-cols-{section.columns}` columns
- Each cell: label above + field below

**FieldRenderer switch on `field.type`:**

```
text, date, number    → <Input> (readOnly if field.readOnly)
currency              → <Input> with "$" prefix display
percent               → <Input> with "%" suffix display
checkbox              → <Checkbox> (disabled if readOnly)
select                → <Select> with field.options
textarea              → <Textarea rows={field.rows}>
action_button         → <Button> calls triggerAction(field.action)
readonly_label        → <span>
```

**Navigator highlight:** If `field.navigatorHighlight && currentStep.targetFieldId === field.id`:

```tsx
className = "ring-2 ring-primary ring-offset-1 rounded-md"
```

**Data binding:**

- `workspaceData` loaded from `claim.workspace_data` (pre-filled JSON)
- Trainee editable fields (`readOnly: false`) write to local `fieldValues` state
- `fieldValues` merged with `workspaceData` for display

**Acceptance criteria:**

- All 9 tabs render from the JSON schema (no hardcoded tabs)
- Claim Lines tab renders as a horizontal-scroll table
- Claim Data tab shows nested sub-tabs (Editing / Prompt Pay / Review / Benefits / Notes)
- Search tab shows sub-tabs (Member / Provider / Claims / Benefits) with search buttons
- `action_button` type renders a button that calls the correct action handler
- `readOnly: true` fields cannot be typed into

---

## TASK 7.4 — Navigator panel

**Purpose:** Right-side step-by-step guidance panel shown in training mode only.

**Files:**

```
features/training/
  model/navigator.store.ts
  view/workspace/NavigatorPanel.tsx
  view/workspace/NavigatorStep.tsx
```

**Visibility:** `mode === "training"` → show. `mode === "assignment"` → `return null`

**Panel structure:**

```
[Header]  "Navigator"  |  "No timer" (or timer countdown in assignment)
[Current step label]  "STEP N OF 9" / step name
[Step list — scrollable]
```

**Step card states:**

```
completed:  border-green-200 bg-green-50,  circle bg-green-500 white check icon
active:     border-primary bg-primary/5,   circle bg-primary white number
future:     border-muted opacity-50,        circle bg-muted muted number
```

**"Mark complete" button:**

- Shown only on the currently active step
- `variant="outline" size="sm"` with `<Check>` icon
- Calls `navigatorStore.markStepComplete(step.id)`
- Records `timeTakenSeconds` from step start timestamp

**After marking complete:**

- Advance `currentStepIndex`
- Show green check + time taken below step name: `"✓ 01:15"`

**Completion trigger types (from navigator schema):**

```
tab_visited:       auto-complete when recordTabVisit(tabId) matches step.targetTabId
subtab_visited:    auto-complete when recordSubTabVisit(tabId, subTabId) matches
field_value_set:   auto-complete when fieldValues[field.id] === step.expectedValue
action_triggered:  auto-complete when triggerAction(action) matches step.action.type
decision_submitted: auto-complete on submit decision
```

**Store shape:**

```ts
interface NavigatorStore {
  steps: NavigatorStep[]
  currentStepIndex: number
  stepStartTimes: Record<string, Date>
  completedStepIds: string[]
  tabVisits: TabVisit[]
  fieldInteractions: FieldInteraction[]

  recordTabVisit(tabId: string): void
  recordSubTabVisit(tabId: string, subTabId: string): void
  recordFieldInteraction(
    tabId: string,
    fieldId: string,
    action: string,
    value?: string
  ): void
  markStepComplete(stepId: string): void
  triggerAction(action: string): void
  reset(): void
}
```

**Acceptance criteria:**

- Steps complete automatically on tab visit (no manual click needed for tab-type steps)
- `markStepComplete` shows time taken on the step card
- Future steps remain dimmed until previous step is complete
- Navigator panel not rendered when `mode=assignment`

---

## TASK 7.5 — Submit decision dialog + result sheet

**Purpose:** Trainee submits Accept/Decline, server scores the attempt,
result is shown as a bottom sheet.

**Files:**

```
features/training/
  view/workspace/SubmitDecisionDialog.tsx
  view/workspace/ResultSheet.tsx
  viewmodel/useSubmitDecision.ts
```

**Submit decision dialog:**

```tsx
<Dialog>
  <DialogTitle>Submit your decision</DialogTitle>
  <DialogDescription>
    Choose Accept or Decline for claim {claim.dcn}
  </DialogDescription>
  <div className="grid grid-cols-2 gap-3">
    <Button
      className="h-16"
      variant={decision === "accept" ? "default" : "outline"}
      onClick={() => setDecision("accept")}
    >
      <CheckCircle className="text-green-500" /> Accept
    </Button>
    <Button
      className="h-16"
      variant={decision === "decline" ? "destructive" : "outline"}
      onClick={() => setDecision("decline")}
    >
      <XCircle /> Decline
    </Button>
  </div>
  <DialogFooter>
    <Button disabled={!decision} onClick={confirmSubmit}>
      Confirm submission
    </Button>
  </DialogFooter>
</Dialog>
```

**API call on confirm:**

```
POST /api/trainee-attempts
Body: {
  claimId, flowId, cohortId, mode,
  decision, reasonCode,
  startedAt, submittedAt,
  navigatorSteps: navigatorStore.steps (with isCompleted, timeTakenSeconds),
  tabVisits: navigatorStore.tabVisits,
  fieldInteractions: navigatorStore.fieldInteractions,
  proxyViolations: proxyStore.violations
}
→ AttemptResult
```

**Result sheet (`<Sheet side="bottom" className="h-[80vh]">`):**

Sections:

1. **Header:** Pass/Fail icon + "Passed!" or "Not passed" + total score
2. **Score breakdown (grid-cols-3 Cards):** Decision N/20 | Reason Code N/10 | Navigator Steps N/70
3. **Timing:** "⏱ {duration}" + "📋 Attempt #{n}"
4. **Decision result Alert:**
   - Correct: green Alert "✓ Correct decision: decline"
   - Wrong: red Alert "✗ You chose accept, correct answer was decline"
5. **Missed steps** (if any): list of step cards with name + description + "−N points" in red
6. **All steps checklist:** completed=green CheckCircle | missed=gray Circle + per-step time + pts
7. **Buttons:** "Retry claim" (outline) | "Back to claims" (primary)

**Scoring (server-side):**

```ts
navigatorScore = sum(earnedPoints for completed steps)
decisionScore  = isDecisionCorrect ? 20 : 0
reasonScore    = isReasonCodeCorrect ? 10 : 0
totalScore     = navigatorScore + decisionScore + reasonScore
passed         = totalScore >= flow.passMark
```

**After submit:**

- Update `trainee_flows` row: increment `totalAttempts`, update `bestScore`, `latestScore`, `status`
- Update `leaderboard_entries` for this trainee × cohort (recompute rank)
- Return full `AttemptResult` to client

**Acceptance criteria:**

- Cannot submit without choosing Accept or Decline
- Result sheet shows correct score breakdown
- Missed steps list only shows steps not completed
- "Retry claim" resets navigator store and workspace to initial state
- `passed: true` updates flow status to "passed" in DB

---

## TASK 7.6 — Assignment mode + proxy detection

**Purpose:** Locked assessment mode with proxy detection.

**Files:**

```
features/training/
  model/proxy.store.ts
  viewmodel/useProxyDetection.ts
  view/workspace/ProxyWarningToast.tsx
  view/workspace/AssignmentTimer.tsx
```

**Mode differences (assignment vs training):**

```
Navigator panel:    hidden
Timer:              visible in topbar, counts down from modeConfig.timeLimitSeconds
Right-click:        prevented
Dev tools:          triggers termination
Tab switch:         warns (max 3 violations before termination)
Window blur:        warns (max 3 violations)
Copy/paste:         warns (max 5 violations)
```

**AssignmentTimer (topbar, assignment mode only):**

```tsx
// Counts down from timeLimitSeconds
// Shows MM:SS format
// Turns red when < 2 minutes remaining
// Auto-submits (with current state) when reaches 00:00
```

**useProxyDetection hook:**

```ts
export function useProxyDetection(
  config: ProxyDetectionConfig,
  onViolation: (type: string, count: number, action: ViolationAction) => void,
  onTerminate: () => void
) {
  // Registers event listeners only when config.enabled === true
  // visibilitychange → tab_switch
  // window blur      → window_blur
  // contextmenu      → right_click (preventDefault)
  // keydown (F12, Ctrl+Shift+I) → dev_tools → onTerminate immediately
  // Returns cleanup function
}
```

**Violation handling:**

```ts
"warn":      show <ProxyWarningToast type={type} count={count} remaining={max - count} />
"prevent":   call e.preventDefault() silently
"terminate": show modal "Session terminated due to integrity violation" → POST attempt with terminated=true
```

**ProxyWarningToast (sonner toast, warning style):**

```
"Warning: tab switch detected (2/3 allowed)"
```

**Proxy violations stored in `proxy.store.ts`:**

```ts
violations: Array<{ type; severity; count; detectedAt; metadata }>
```

Sent with attempt submission payload.

**Acceptance criteria:**

- Right-clicking anywhere shows no context menu in assignment mode
- Third tab switch shows termination modal, prevents further interaction
- Timer auto-submits with all current state when it reaches zero
- Pressing F12 immediately terminates the session

---

---

# TASK GROUP 8 — API ROUTES

---

## TASK 8.1 — Cohort routes

**File:** `apps/api/src/routes/cohorts.ts`

```
GET    /api/cohorts                           → list all (admin) or by trainer (trainer)
POST   /api/cohorts                           → create (admin only)
GET    /api/cohorts/:id                       → get single with stats
PATCH  /api/cohorts/:id                       → update (admin only)
DELETE /api/cohorts/:id                       → delete if draft (admin only)
POST   /api/cohorts/:id/activate              → status draft → active (locks scenario assignments)
POST   /api/cohorts/:id/complete              → status active → completed
POST   /api/cohorts/:id/archive              → status → archived
GET    /api/cohorts/:id/stats                 → KPI aggregate (enrolled, completed, avgScore, attended, sessions)
GET    /api/cohorts/:id/trainees/progress     → trainee progress rows for detail page
GET    /api/cohorts/:id/leaderboard           → ranked entries, sorted by total_score DESC
```

**Auth middleware on all routes:** `requireAuth`
**RBAC middleware:**

- POST/PATCH/DELETE/activate/complete/archive → `requireRole(["admin"])`
- trainer GET routes → validate trainer is assigned to cohort

---

## TASK 8.2 — Trainer + Trainee routes

**File:** `apps/api/src/routes/trainers.ts`

```
GET    /api/trainers                           → list all trainers
POST   /api/trainers                           → create trainer + user account
PATCH  /api/trainers/:id/status               → update active/inactive
DELETE /api/trainers/:id                       → soft delete
GET    /api/trainers/:id/cohorts              → trainer's assigned cohorts with stats
```

**File:** `apps/api/src/routes/trainees.ts`

```
GET    /api/trainees                           → list all
POST   /api/trainees                           → create single (auto-generate HYTR-ID)
POST   /api/trainees/bulk                      → CSV import (parse rows, insert valid, return errors)
PATCH  /api/trainees/:id/status               → update active/inactive
DELETE /api/trainees/:id                       → soft delete
GET    /api/trainees/me/home                  → trainee dashboard aggregate
```

---

## TASK 8.3 — Training content routes

**File:** `apps/api/src/routes/training.ts`

```
GET    /api/scenarios                          → list by cohort
GET    /api/scenarios/:id/with-tree           → scenario + sub-scenarios + flows + claims + docs
GET    /api/flows/:id/workspace               → returns workspace schema JSON
GET    /api/flows/:id/navigator               → returns navigator schema JSON
GET    /api/claims/:id                         → claim detail with workspace_data
POST   /api/trainee-flows/:id/mark-video-complete
GET    /api/trainees/me/flow-progress         → all trainee_flows for current trainee
```

---

## TASK 8.4 — Attempt routes

**File:** `apps/api/src/routes/attempts.ts`

```
POST   /api/trainee-attempts                  → submit attempt (full payload)
GET    /api/trainee-attempts/:id              → get result
GET    /api/claims/:id/attempts              → all attempts for a claim by current trainee
```

**POST /api/trainee-attempts logic (in order):**

1. Validate body with Zod
2. Verify `claim.correctDecision` and `claim.correctReasonCode`
3. Compute `isDecisionCorrect`, `isReasonCodeCorrect`
4. Compute `navigatorStepScore` from submitted step results
5. Compute `decisionScore` (20 if correct, 0 if not)
6. Compute `reasonCodeScore` (10 if correct, 0 if not)
7. Compute `totalScore = navigatorScore + decisionScore + reasonCodeScore`
8. Compute `passed = totalScore >= flow.passMark`
9. Insert `trainee_attempts` row
10. Batch insert `attempt_step_results`, `attempt_tab_visits`,
    `attempt_field_interactions`, `proxy_violations`
11. Update `trainee_flows`: increment `total_attempts`, update scores, status,
    `last_activity_at`, `completed_at` if passed
12. Recompute `leaderboard_entries` for this trainee × cohort
13. Return full `AttemptResult` including `pendingSteps`

---

## TASK 8.5 — Reports routes

**File:** `apps/api/src/routes/reports.ts`

```
GET    /api/reports/export?type=cohort_level&cohortId=&status=&from=&to=
GET    /api/reports/export?type=attendance&...
GET    /api/reports/export?type=training_completion&...
GET    /api/reports/export?type=progress&...
GET    /api/reports/export?type=assessment_results&...&from=&to=
GET    /api/reports/export?type=assessment_outcome&cohortId=&assessmentName=
GET    /api/reports/assessment-names?cohortId=  → picker for Assessment Outcome
POST   /api/report-exports                    → log export audit record
```

**Each export handler:**

1. Validate query params
2. If trainer: verify cohort belongs to trainer
3. Build SQL query with filters
4. Format rows (currency as string with $, dates as dd/MM/yyyy, null as "—")
5. Return `{ sheetName, filename, rows: Row[] }`

---

---

# TASK GROUP 9 — SHARED COMPONENTS LIBRARY

---

## TASK 9.1 — DataTable wrapper

**File:** `apps/web/src/components/data-table/DataTable.tsx`

```ts
interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  searchPlaceholder?: string
  isLoading?: boolean
  emptyState?: ReactNode
  onRowClick?: (row: TData) => void
}
```

**Features:**

- `useReactTable` with `getCoreRowModel`, `getFilteredRowModel`, `getPaginationRowModel`
- Global filter input (debounced 300ms)
- Skeleton loading (5 rows × column count)
- Clickable rows when `onRowClick` provided
- `<DataTablePagination>` below table

**DataTablePagination:**

```tsx
// "Showing {from} to {to} of {total} results"
// Page size selector: <Select> [10, 25, 50]
// Prev / Next buttons
```

---

## TASK 9.2 — StatusBadge component

**File:** `apps/web/src/components/StatusBadge.tsx`

```ts
type Status =
  | "active"
  | "draft"
  | "completed"
  | "archived"
  | "on_track"
  | "at_risk"
  | "not_started"
  | "passed"
  | "failed"

// Returns <Badge variant="outline"> with correct colour classes per status
// Includes coloured dot before text for active/on_track/at_risk states
```

---

## TASK 9.3 — ConfirmDialog component

**File:** `apps/web/src/components/ConfirmDialog.tsx`

```ts
interface ConfirmDialogProps {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel?: string // default "Delete"
  variant?: "destructive" | "default"
  onConfirm: () => Promise<void> | void
}
// Uses AlertDialog — shows loading on confirm button while onConfirm runs
```

---

## TASK 9.4 — API client

**File:** `apps/web/src/lib/api.ts`

```ts
// Thin wrapper around fetch
// Base URL from VITE_API_URL env var
// Automatically includes credentials: "include" (for session cookie)
// Throws typed ApiError on non-2xx responses
// Methods: get<T>, post<T>, patch<T>, delete<T>
```

---

---

# TASK GROUP 10 — TESTING & VALIDATION

---

## TASK 10.1 — API integration tests

**Tool:** Vitest + supertest

**Test file:** `apps/api/src/__tests__/auth.test.ts`

```
✓ POST /api/auth/send-otp returns 200 for valid email
✓ POST /api/auth/verify-otp returns 401 for wrong OTP
✓ GET  /api/auth/me returns 401 without session
```

**Test file:** `apps/api/src/__tests__/cohorts.test.ts`

```
✓ GET  /api/cohorts requires auth (401 without cookie)
✓ POST /api/cohorts requires admin role (403 for trainer)
✓ POST /api/cohorts with valid body creates cohort, returns 201
✓ POST /api/cohorts/:id/activate changes status to active
✓ DELETE /api/cohorts/:id fails if status is active (400)
```

**Test file:** `apps/api/src/__tests__/attempts.test.ts`

```
✓ POST /api/trainee-attempts with correct decision → passed: true, totalScore ≥ passMark
✓ POST /api/trainee-attempts with wrong decision → isDecisionCorrect: false
✓ Navigator step scores sum correctly
✓ leaderboard_entries updated after attempt
```

---

## TASK 10.2 — End-to-end smoke tests

**Tool:** Playwright

**File:** `apps/web/e2e/login.spec.ts`

```
✓ Navigate to / → redirected to /login
✓ Enter email → OTP input appears
✓ Enter correct OTP → lands on correct role home page
```

**File:** `apps/web/e2e/admin-cohort.spec.ts`

```
✓ Admin creates cohort → appears in table
✓ Admin activates cohort → status badge changes to Active
✓ Admin cannot delete active cohort
```

**File:** `apps/web/e2e/trainee-workspace.spec.ts`

```
✓ Trainee clicks Start on a claim → workspace opens
✓ Clicking tabs records tab visit in navigator
✓ Submitting correct decision → result sheet shows "Passed!"
```

---

---

# APPENDIX — IMPLEMENTATION RULES FOR AI ASSISTANTS

1. **Never skip the MVVM split.** If you are writing a `fetch()` inside a
   component, stop and move it to the viewmodel or store.

2. **Zod first.** Write the Zod schema before writing any form or API handler.
   The schema is the contract.

3. **shadcn only for UI primitives.** Do not install other component libraries.
   Do not write custom CSS — use Tailwind utility classes only.

4. **No `any` types.** Every function parameter and return value must be typed.
   Use the inferred Drizzle types (`typeof users.$inferSelect`) everywhere.

5. **Error handling is not optional.** Every API route must have try/catch.
   Every form must show field-level errors. Every async button must show a
   loading state.

6. **Database queries use the query builder.** Do not write raw SQL strings.
   Use `db.select().from(table).where(eq(...))` or `db.query.table.findMany(...)`.

7. **The JSON schema drives the UI.** The workspace tabs, sections, and fields
   must be rendered from the JSON — never hardcoded. Adding a new tab should
   require only a database change, not a code change.

8. **Sonner for all toasts.** Import `toast` from `sonner`.
   `toast.success(...)` / `toast.error(...)`. No `alert()`.

9. **Format IDs correctly.** Trainee IDs are always `HYTR-XXXXX`,
   Trainer IDs are always `CRTR-XXXXX`, DCNs are always `DCN-XXXXXX`.
   Use the helpers in `@platform/db/ids`.

10. **Proxy detection only runs in assignment mode.** Gate every event listener
    registration behind `if (mode === "assignment" && config.enabled)`.
