# YMSNOW — Yard Management System

## Overview

Production-grade Yard Management System (YMS) built as a pnpm monorepo with TypeScript. Features 15+ operational pages with real-time data, AI-powered email intelligence, and an interactive yard map.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + shadcn/ui + Wouter + TanStack Query + Framer Motion
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **AI**: OpenAI (via Replit AI Integrations — `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (API server), Vite (frontend)

## Structure

```text
artifacts/
├── api-server/         # Express API server (port 8080)
│   └── src/
│       ├── app.ts                  # Express app setup, mounts YMS routes
│       ├── db.ts                   # Re-exports db from @workspace/db
│       └── lib/
│           ├── register-yms-routes.ts  # All 70+ YMS API routes
│           ├── storage.ts              # Database access layer (1300+ lines)
│           ├── assistant.ts            # AI assistant routes (OpenAI streaming)
│           ├── email-intelligence.ts   # Email AI analysis engine
│           ├── seed.ts                 # Demo data seeder
│           └── manual-html.ts          # User manual generator
└── yms/                # React frontend (port varies, preview at /)
    └── src/
        ├── App.tsx                 # Root with Wouter router + sidebar layout
        ├── pages/                  # 15+ page components
        ├── components/             # Reusable UI + ai-assistant + email-inbox
        ├── hooks/                  # use-auth, use-toast, etc.
        └── lib/                    # queryClient, theme-provider, utils

lib/
├── db/                 # Drizzle ORM schema + DB connection (@workspace/db)
│   └── src/schema/
│       ├── auth.ts     # Users table
│       └── index.ts    # All YMS tables (carriers, visits, appointments,
│                       #   dock_doors, yard_zones, yard_slots, inspections,
│                       #   exceptions, move_tasks, email intelligence tables, etc.)
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks
└── api-zod/            # Generated Zod schemas
```

## Pages & Routes (Frontend)

| Page | Route |
|---|---|
| Dashboard | `/` |
| Appointments | `/appointments` |
| Gate Check-In | `/gate/check-in` |
| Gate Check-Out | `/gate/check-out` |
| Yard Inventory | `/yard/inventory` |
| Yard Map | `/yard/map` |
| Dock Management | `/dock` |
| Move Tasks | `/moves` |
| Holds & Exceptions | `/exceptions` |
| Inspections | `/inspections` |
| Reports & Analytics | `/reports` |
| Revenue / Billing | `/revenue` |
| Email Intelligence | `/email-intelligence` |
| Yard Walk | `/yard/audit` |
| Admin: Carriers | `/admin/carriers` |
| Admin: Yard Setup | `/admin/yard-setup` |
| Admin: Users | `/admin/users` |
| Admin: Audit Log | `/admin/audit` |
| Admin: AI Config | `/admin/ai-config` |
| User Manual | `/manual` |
| **Notifications Center** | `/notifications` |
| **Gate Guard Mode** | `/gate/guard-mode` (no sidebar, full-screen) |
| **Carrier Self-Service Portal** | `/portal` (public, no auth) |

## Key API Endpoints

- `POST /api/admin/reset-to-seed` — Reset DB and re-seed demo data
- `POST /api/gate/check-in` — Gate entry flow
- `GET/POST /api/visits` — Visit management
- `GET/POST /api/appointments` — Appointment management
- `GET /api/dashboard` — Dashboard KPIs
- `GET /api/yard/slots` — Yard slot inventory
- `GET /api/dock/doors` — Dock door status
- `GET /api/moves/all` — All move tasks (enriched with visit/carrier/user data)
- `GET /api/moves/:id` — Individual move task (enriched)
- `GET /api/exceptions/:id` — Individual exception (enriched with visit info)
- `PATCH /api/exceptions/:id` — Update exception (assign, severity, status)
- `POST /api/email-intelligence/process-demo` — Run AI email analysis
- `POST /api/assistant/chat` — AI assistant (streaming SSE)
- `GET /api/notifications` — Unified alerts (escalated tasks + exceptions + email conflicts); also triggers auto-escalation of 90-min-old move tasks
- `PATCH /api/notifications/dismiss/:type/:id` — Dismiss an exception or email alert
- `POST /api/notifications/mark-all-read` — Bulk mark all open exceptions + email alerts as acknowledged
- `GET /api/portal/available-slots?date=YYYY-MM-DD` — Available booking slots for carrier portal
- `POST /api/portal/book` — Submit a new carrier appointment booking

## Phase 1 — Data Foundation & API Fixes

### Schema Changes
- `carriers.brand_colour varchar(7)` — Carrier brand hex colour (e.g. `#FF6B00`). Exposed in `PATCH /api/carriers/:id` as `brandColour`.

### Seed Improvements
- All 12 carriers seeded with representative brand colours (matching real carrier liveries)
- Move tasks now have explicit `createdAt` values (15–55 min for open/assigned, 2.5 h for the escalated task) — prevents entire queue from auto-escalating immediately after a fresh seed

### API Fixes
- **`GET /api/moves` active filter** now includes `assigned` and `escalated` statuses (was missing both — only returned `open`, `accepted`, `in_progress`)
- **`GET /api/moves/:id`** — Individual move task with full visit/carrier/user enrichment
- **`GET /api/exceptions/:id`** — Individual exception with visit and user enrichment
- **`PATCH /api/exceptions/:id`** — Update exception fields (assignedTo, severity, description, status)
- **`POST /api/notifications/mark-all-read`** — Bulk-acknowledges all open exceptions + email alerts

## Performance Optimizations (Session 6)

### N+1 Query Elimination
All major API endpoints now use batch queries / JOINs — no per-row round-trips to PostgreSQL:

| Method | Before | After |
|---|---|---|
| `getYardInventory()` | 5 queries per trailer | 1 JOIN + 2 batch queries |
| `getDashboardStats()` | N individual carrier/door/slot queries | 1 JOIN query for all recent visits |
| `getYardMapData()` | 3 queries per slot | Batch fetch all visits + carriers + moves |
| `getDockDoorsView()` | 2 queries per door | 1 JOIN query for all doors |
| `GET /api/moves` | N visit + N carrier queries per task | Batch maps (3 flat queries total) |
| `GET /api/sidebar/stats` | `SELECT * FROM visits` (full table scan) | 3 COUNT/GROUP BY queries |

### HTTP Compression
`compression` middleware added to Express app — JSON responses compressed with gzip (81% size reduction on `/api/yard/inventory`).

### Dead Package Removal
Removed from `artifacts/yms/package.json`:
- `react-icons` (84MB — never imported anywhere)
- `framer-motion` (5.5MB — never imported anywhere)
- `cmdk`, `embla-carousel-react`, `input-otp`, `vaul` (backing packages for 4 unused shadcn UI components)
- Deleted corresponding unused component files: `carousel.tsx`, `command.tsx`, `drawer.tsx`, `input-otp.tsx`

### Vite Chunk Splitting
`manualChunks` added to `vite.config.ts`: recharts, dnd-kit, ui (Radix + lucide), vendor (react + wouter + tanstack) — improves browser caching on repeat visits.

## New Features (Session 4 — Move Control Logic)

### Move Control: Unified Move Creation Dialogs (T002)
- "Assign Slot" and "Assign Dock" buttons in Yard Inventory now **always create move tasks** (dispatch jockey toggle removed)
- Both dialogs show: Assign Jockey dropdown (with status/active count), Priority selector, Remarks textarea, and destination list
- Movement status tags appear in the Status column for trailers with active moves (Move Pending / Move Assigned / Move In Progress / etc.)
- Action buttons lock with "Move In Process" state when a trailer has an active non-terminal move
- Clicking a locked button shows a toast describing the active move status
- `GET /api/yard/jockeys` returns `activeMoveCount` + `jockeyStatus` (available/busy)
- `GET /api/visits/:id/moves` lists all move tasks for a specific visit

### Move Tasks Tab Restructure (T003)
- Tabs restructured from 6 (Available / Assigned / My Work / In Progress / Completed Today / Rejected) to 4:
  - **Unassigned** — status = `open` (no jockey assigned yet)
  - **Assigned** — status = `assigned` or `accepted` (jockey assigned, not yet started)
  - **In Progress** — status = `in_progress`
  - **Completed** — status = `completed`, `rejected`, or `cancelled`
- Tab badges are color-coded (blue/violet/amber/emerald)
- Jockey view filters Assigned and In Progress tabs to their own tasks
- data-testids: `queue-unassigned`, `queue-assigned`, `queue-in_progress`, `queue-completed`

### Move Control Module Cleanup (Session 5)
- **`moveType` dynamic in assign_dock dialog**: was hardcoded to `"slot_to_dock"`; now computed from `fromLocationType` (slot→dock = `"slot_to_dock"`, gate→dock = `"gate_to_dock"`, dock→dock = `"reposition"`)
- **`DialogDescription` added** to all move-creation dialogs (assign_slot, assign_dock, create_move in yard-inventory.tsx; assign + priority dialogs in move-tasks.tsx) — eliminates accessibility console warnings
- **Jockey selector improved** in move-tasks.tsx assign dialog: uses `j.activeMoveCount` / `j.jockeyStatus` from API data directly (amber dot + count for busy, green dot + "idle" for available) instead of derived workload lookup
- **Redundant if/else removed** in `unassigned` filter case of move-tasks.tsx `queuedTasks` useMemo

## New Features (Session 3)

### Task Escalation (T001)
Move tasks with status `open` or `assigned` that are older than 90 minutes are automatically promoted to `escalated` when `GET /api/moves` or `GET /api/notifications` is called.

### Notifications Center (T002)
- Route: `/notifications`  
- Sidebar item with live badge count  
- Bell icon with count in the app header  
- Aggregates: escalated tasks (red), open exceptions, new email intelligence conflicts  
- Dismiss button for exceptions/email alerts; auto-refreshes every 30 seconds

### Gate Guard Mode (T003)
- Route: `/gate/guard-mode`  
- Renders full-screen without the sidebar  
- Accessible via "Guard Mode" button on Gate Check-In page header  
- Streamlined 3-step flow: search → form → gate pass  
- Gate pass printout opens a new browser window

### Print Gate Pass (T004)
- Wired up the existing "Print Gate Pass" button in Gate Check-In done step  
- Opens a formatted print window with visit #, carrier, driver, trailer, movement type, time, and signature lines

### Dock Scheduling Calendar (T005)
- Grid/Schedule toggle in the Dock Management filter bar  
- Schedule view shows a horizontal timeline (6 AM – 10 PM) per dock door  
- Color-coded blocks: Loading (amber), Unloading (blue), At Dock (violet), Ready Out (green)  
- Red vertical line = current time

### Carrier Self-Service Portal (T006)
- Route: `/portal` (publicly accessible, no auth required)  
- 3-step booking flow: date + movement type → time slot → carrier details → confirmation  
- Slots capped at 3 bookings each; full slots shown as unavailable  
- Creates a real appointment record with status `scheduled` and source `carrier_portal`  
- Issues a `PORT-XXXXXX` reference number on confirmation

## Product Manual v2.0 & Screenshots

- Manual accessible at `/manual` — full styled HTML with 18 sections, 18 module cards, capability table, user journey maps
- **22 live screenshots** captured via system Chromium at `artifacts/yms/public/screenshots/*.png`
  - All 16 operational module pages + notifications, gate-guard, carrier-portal, ai-config, jockey-board
  - Screenshot filenames: `dashboard`, `appointments`, `gate-checkin`, `gate-checkout`, `inventory`, `yard-map`, `dock`, `move-tasks`, `exceptions`, `yard-audit`, `inspections`, `reports`, `carriers`, `yard-setup`, `audit-log`, `jockey-board`, `notifications`, `gate-guard`, `carrier-portal`, `ai-config` + alias copies
- **Section 8** (Workflow Chain): inline Figure 8-A showing gate-checkin screenshot
- **Section 9** (Jockey Board): inline Figure 9-A showing jockey-board kanban screenshot  
- **Download HTML**: `/api/manual/download` returns a self-contained HTML file with **18 base64-embedded screenshots** (3.5 MB)
- Screenshot capture script: `/tmp/screencap/capture.mjs` — uses system Chromium at `/nix/store/.../chromium`
- System Chromium installed via `installSystemDependencies({ packages: ["chromium"] })`

## Phase 2 UI/UX Improvements (Completed)

### Dashboard Overhaul
- **KPI Grid**: 6-card grid (`grid-cols-2 md:grid-cols-3`) via `kpiGrid` prop on PageHeader; each card has hover affordance, bottom-right chevron, and `href` for navigation
- **Yard Inventory KPI card**: inline progress bar showing `n / total slots` with colour-coded fill (green/amber/red)
- **Action Required panel**: reordered (holds → overdue moves → awaiting slot → ready out → aged), hover-reveal action buttons, oldest age display per category
- **Gate Activity**: dwell time coloured by `getDwellColour()`, red `⚠ Aged` pill + red left border on rows ≥ 1440 min
- **Dock Floor**: time-at-dock shown below each occupied door, colour-coded by dwell
- **Exceptions widget**: type badge chips (DOC/SEC/DMG/CST/CRR), 2-line `line-clamp-2` description
- **Move Queue header**: breakdown badges showing "N in progress / N pending"
- **SupervisorDashboard + AdminDashboard**: now use `kpiGrid={true}` and pass `exceptions`/`moves` to ActionRequiredPanel

### Gate Check-In
- **Fast Lane mode toggle**: amber button in header, amber banner explaining skip-verification mode
- **Tab count badges**: Check-In shows expected count, Check-Out shows checked-in count
- **Expected Today panel**: scrollable (`max-h-[520px] overflow-y-auto`) with count badge

### Yard Inventory
- **Next Step buttons**: clickable coloured pills linking to the appropriate page (red=exceptions, green=check-out, blue=dock/moves); plain span shown when no actionable link
- Added `getNextStepHref()` and `getNextStepStyle()` helpers

### Move Tasks
- **Priority left-border stripes**: table rows use `priorityCardBorder()` — red for urgent, amber for high, none for normal (consistent with Kanban cards)

### Dock Management
- **SLA countdown ring**: SVG circle ring replaces door-number badge for occupied doors; ring colour tracks SLA level (green < 2h, amber 2–4h, red ≥ 4h); shows elapsed time + label in centre

### Shared Utilities
- `artifacts/yms/src/lib/dwell.ts`: `getDwellColour(mins)` → Tailwind text colour class; `getDwellRowTint(mins)` → row background tint class

## Phase 3 UX Polish (Completed)

### Header — Shift Clock (T01)
- `ShiftClock` component in `App.tsx` reads/writes `ymsnow_shift_start` in `sessionStorage`
- Shows "Shift HH:MM · Xh Ym elapsed", recomputes every 60 s; visible to sm+ breakpoints
- Positioned between breadcrumbs area and action buttons; separated by a `<Separator>`

### Notification Bell Severity Colour (T02)
- Bell badge colour is now dynamic: red+pulse for critical/high, amber for medium, blue for low
- Notification query fetches full `{id, severity, isRead}` array instead of just a count

### Sidebar Role-Based Filtering (T03)
- Every nav item has a `roles` array — gate_guard sees only Gate + Notifications; jockey sees Moves/Map/Notifications; dock_user sees Dock/Inventory/Moves/Notifications; carrier sees Appointments/Notifications
- Added **Notifications** nav item (no roles → visible to everyone) with `notificationsCount` badge
- Added **Revenue** nav item (admin/yard_manager/supervisor) with `TrendingUp` icon

### Gate Check-In — Guard Mode Auto-Activation (T04)
- On mount, `GateCheckInPage` reads `getCurrentRole()` from sessionStorage
- If role is `gate_guard` and `ymsnow_guard_auto_activated` key is absent, redirects to `/gate/guard-mode` and sets the key (single redirect per session)

### HoldTypeBadge Component (T05)
- `artifacts/yms/src/components/hold-type-badge.tsx` — shared badge with icon + label per hold type
- Types: `documentation_hold` (yellow/FileText), `security_hold` (purple/Shield), `damage_hold` (red/Wrench), `customs_hold` (blue/Globe), `manual_modification` (amber/Edit2), `seal_mismatch` (orange/AlertOctagon)
- Used in `exceptions.tsx` (replacing raw StatusChip); exported `holdTypeColor()` for plain color lookups
- Props: `type`, `size` (xs/sm/md), `showIcon`, `showLabel`

### Dock Door Number + Movement Badge (T06)
- Door number in idle card boosted from `text-lg` to `text-[28px] font-black` for at-a-glance scanning
- New `MovementBadge` component in `dock-management.tsx` renders colour-coded pill with icon+label instead of plain text

### Revenue Intelligence in Sidebar (T07)
- **Revenue** sidebar item navigates to `/revenue` (TrendingUp icon, admin/yard_manager/supervisor roles)
- `RevenueKpiSection` already present on AdminDashboard and SupervisorDashboard

### Skeleton Loaders (T08)
- Dock Management: full skeleton grid (4 KPI + 10 door cards) while `isLoading`
- Yard Inventory, Move Tasks, Appointments: skeleton loaders already in place from Phase 1/2

### Dashboard — Remove System Administration Banner (T09)
- `AdminDashboard` header changed from `title="System Administration"` to `title="Operational Overview"` with subtitle "Full-facility visibility — yard, gate, dock, and fleet"
- Icon changed from Settings to Activity

### Appointments — Calendar Default + localStorage (T10)
- `viewMode` state initialises from `localStorage.getItem("ymsnow_appointments_view")`, defaulting to `"calendar"` if absent
- All toggle button handlers call `handleViewMode()` which persists the choice to localStorage

## Database

- **Provider**: Replit PostgreSQL
- **ORM**: Drizzle Kit
- **Push schema**: `pnpm --filter @workspace/db run push`
- **Seed data**: `POST /api/admin/reset-to-seed` or the `/admin/ai-config` page has a reset button

## AI Features

The AI assistant and email intelligence use OpenAI. Connect via Replit AI Integrations (OpenAI connector) which sets `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` automatically. The system gracefully degrades if no key is configured.

## Development

```bash
# Install all dependencies
pnpm install

# Push DB schema (first time or after schema changes)
pnpm --filter @workspace/db run push

# Start API server (dev)
pnpm --filter @workspace/api-server run dev

# Start YMS frontend (dev)
pnpm --filter @workspace/yms run dev
```

## Phase 4 UX Improvements (Complete)

### P4-T01: AI Copilot — Contextual Suggested Prompts
- `ai-assistant.tsx`: Added `useQuery` for `/api/dashboard/stats` (enabled when panel is open)
- Built `contextualPrompts` array: 2 base prompts always shown + up to 4 dynamic prompts based on live yard state (`agedTrailers`, `overdueMoves`, `trailersOnHold`, `trailersAtDock`)
- Shown in a 2-column grid with heading "Suggested for this yard state" when `!hasConversation`
- Screen-specific suggestions still shown below in pill chips; all disappear once first message sent

### P4-T02: Yard Map — Zone Labels + Filter Bar
- `yard-map.tsx`: `ZONE_HEADER` increased from 30 → 38px to accommodate two-line labels
- Zone name text: `fontSize=13`, `fontWeight="500"` — larger and less heavy for readability
- Sub-label added: `"{N} slots · {X} occupied"` at 8.5px below the zone name
- Filter bar added between legend and SVG canvas: carrier dropdown (unique occupied carrier names) + status dropdown (empty/occupied/hold/ready_out) + "Clear" button
- Active filter shows match count: `"{M} of {N} slots shown"` 
- Non-matching slots dim to `opacity: 0.15` with a smooth 0.2s CSS transition

### P4-T03: Sidebar — Operations Non-Collapsible
- `app-sidebar.tsx`: `CollapsibleNavGroup` gains optional `collapsible?: boolean` prop (default `true`)
- When `collapsible={false}`: renders a plain `SidebarGroup` with no `<Collapsible>` wrapper — section label is always visible with no chevron
- Operations section passes `collapsible={false}`; Compliance and Configurations remain collapsible

### P4-T04: Sidebar — Active State Visibility
- Active nav item: `bg-primary/10` (up from `/5`), `font-bold` (was `font-semibold`), `pl-4` indent for left-border clearance
- Left indicator bar: `top-0.5 bottom-0.5` (tighter fit), icon inherits `text-primary`
- Badges: `bg-red-500 text-white` for `exceptionsOpen` (Holds & Exceptions), `bg-primary text-primary-foreground` for all other count badges (was `variant="secondary"`)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from root**: `pnpm run typecheck`
- **`emitDeclarationOnly`**: JS bundling is handled by esbuild/tsx/vite, not `tsc`
- **Project references**: cross-package imports need the dep in `references` array
