# YMSNOW — Yard Management System

## Overview

Production-grade Yard Management System (YMS) built as a pnpm monorepo with TypeScript. Features 15+ operational pages with real-time data, AI-powered email intelligence, and an interactive yard map.

## Stack

- **Monorepo tool**: pnpm workspaces (workspace root: `replit/`)
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + shadcn/ui + Wouter + TanStack Query + Framer Motion
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **AI**: OpenAI (via Replit AI Integrations — `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (API server), Vite (frontend)

## Replit Environment Setup

- **Database**: Replit PostgreSQL (DATABASE_URL env var)
- **Frontend port**: 5000 (webview workflow)
- **Backend port**: 8080 (console workflow)
- **Frontend proxies `/api` → localhost:8080**

## Workflows

- **Start application**: `cd replit && PORT=5000 pnpm --filter @workspace/yms run dev` (port 5000, webview)
- **Start API Server**: `cd replit && PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080, console)

## Structure

```text
replit/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── yms/                # React frontend (port 5000)
├── lib/
│   ├── db/                 # Drizzle ORM schema + DB connection (@workspace/db)
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   └── api-zod/            # Generated Zod schemas
└── scripts/
    └── post-merge.sh       # pnpm install + db push
```

## Development Commands

```bash
# Install all dependencies
cd replit && pnpm install

# Push DB schema (first time or after schema changes)
cd replit && pnpm --filter @workspace/db run push

# Start API server (dev)
cd replit && PORT=8080 pnpm --filter @workspace/api-server run dev

# Start YMS frontend (dev)
cd replit && PORT=5000 pnpm --filter @workspace/yms run dev
```

## Deployment

- Target: autoscale
- Build: `cd replit && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/yms run build`
- Run: `cd replit && PORT=8080 node artifacts/api-server/dist/index.cjs & PORT=5000 pnpm --filter @workspace/yms run serve`

## Product Mode System

Three-mode product system persisted to `localStorage` (`ymsnow_product_mode`):

- **Standard** — conventional YMS, no AI features rendered
- **Assist** — AI helper layer injected into existing workflows (non-destructive)
- **Optimize** — all AI features including predictive panels

### Assist Mode Components

| Component | File | Injected Into |
|---|---|---|
| `AIRecommendationCard` | `components/ai-recommendation-card.tsx` | Reusable — used by MovesAssistPanel |
| `AppointmentsAssistPanel` | `components/assist/appointments-assist-panel.tsx` | `pages/appointments.tsx` (after KPI strip) |
| `MovesAssistPanel` | `components/assist/moves-assist-panel.tsx` | `pages/move-tasks.tsx` (Unassigned queue tab) |
| `ExceptionAIInsight` | `components/assist/exception-ai-insight.tsx` | `pages/exceptions.tsx` (inline each open exception card) |

All AI enhancements gate behind `showAIRecommendations(mode)` from `lib/product-mode.tsx`. Standard mode sees no AI content. Manual workflows remain unchanged and are always primary.

### Assist Features

- **Appointments**: Collapsible panel with slot suggestions, conflict detection (3+ bookings = warning), and "Book from message" text parser to pre-fill booking form fields from pasted emails
- **Yard/Moves**: Top 2 visible (+ "show more") recommended unassigned moves, ranked by escalation status, urgency, dock dependency, aging age (>60 min SLA warning), with dismissible AI reason cards
- **Exceptions**: Compact inline cause tag + "View insight" button per open exception — opens explainability drawer

### AI Explainability

`components/assist/ai-explainability-drawer.tsx` — a `Sheet`-based side drawer that shows full recommendation context:
- Reason, relevant signals list, confidence bar, expected impact, suggested action, override reminder
- Mode-aware language (Assist: "Suggested by AI / Review before applying"; Optimize: "Optimization Insight / Predicted confidence")

`lib/ai-payload.ts` — shared `AIRecommendationPayload` typed interface used by all recommendation cards and the drawer.

`lib/ai-copy.ts` — `getAICopy(mode)` utility returning mode-appropriate labels. Used by all assist components.

### AI Copy Language

- Standard: zero AI labels or badges
- Assist: "Suggested by AI", "Review before applying", "Confidence"  
- Optimize: "Optimization Insight", "Predicted by AI", "Predicted risk", "Predicted confidence"

### Sidebar AI Demoting

AI Copilot renamed to "AI Configuration" with `subtle: true` flag — renders at 40% opacity, smaller font, below Email Intelligence and Lifecycle Video in the Administration section. Still navigable but visually de-emphasized.

## Optimize Mode — Operational Intelligence Layer

### Recommendation Service (`lib/recommendation-service.ts`)

Pure, deterministic, no API calls. Functions:
- `getBottleneckAlerts(stats, moves, docks)` — overdue moves ≥ 1, all docks occupied, slot backlog ≥ 5
- `getDwellRiskAlerts(stats)` — trailers aged ≥ 24h, avg dwell ≥ 4h
- `getRecommendedNextMoves(moves)` — top 3 available moves sorted by priority then age
- `getDockAppointmentRisk(stats)` — overdue appointments, trailers on hold ≥ 2
- `getNextBestAction(all)` — highest-priority alert across all buckets
- `buildOperationalBrief(stats, moves, docks)` → `OperationalBrief` (all 5 buckets + totalAlerts)
- `buildAssistSummary(stats, moves)` → summary items for the Assist banner

### Optimize Dashboard Panel (`components/optimize/optimize-dashboard-panel.tsx`)

Two exported components:

**`OptimizeDashboardPanel`** (Optimize mode only) — shows:
- "Next Best Action" — blue bordered call-to-action card, most critical recommendation
- 4 alert buckets in a 2×2 / 4-column grid: Bottlenecks | Dwell Risk | Recommended Moves | Dock & Appt Risk
- Each bucket: colour-coded priority dots, top 2 recs, count badge, "View" link, "All clear" state if empty

**`AssistSummaryBanner`** (Assist mode only) — slim violet banner listing pending counts (moves, overdue appointments, exceptions, aged trailers) with links.

### Dashboard Mode Injection

`AdminDashboard` and `SupervisorDashboard` both now:
1. Call `useProductMode()` to get the current mode
2. In Assist mode: render `AssistSummaryBanner` between PageHeader and the main grid
3. In Optimize mode: render `OptimizeDashboardPanel` between PageHeader and the main grid
4. Standard mode: unchanged — no AI panels, no banners

### Sidebar Secondary Items

New `secondary?: boolean` flag on `NavItem`. Secondary items render at ~55% opacity, smaller text (12px) — still fully accessible, just visually de-emphasised. Demoted items:
- Yard Map (Yard Inventory is the primary Yard surface)
- Inspections
- Yard Audit
- Revenue
- Notifications

Primary commercial items at full prominence: Dashboard, Appointments, Gate Operations, Yard Inventory, Dock Management, Yard Moves, Holds & Exceptions, Reports & Analytics, Carrier Management.

## Demo & Presentation Layer

### Demo Helper (`components/demo-helper.tsx`)
Dismissible mode-explainer card that appears at the top of the dashboard for admin and yard_manager roles. Per-mode localStorage dismissal key (`ymsnow_demo_helper_dismissed`). Content is enterprise-toned:
- **Standard** — "Core yard operations — full manual control" with 3 operational bullets
- **Assist** — "AI recommendations reduce manual decision load" with 3 specific capability bullets
- **Optimize** — "Proactive orchestration — bottlenecks caught before they compound" with 3 intelligence bullets

Each card has a mode badge, heading, subtext, bullet list, and a "Got it" dismiss button. A small note reminds: "Manual workflows remain available in all modes."

### ROI / Impact Panel (`components/optimize/roi-panel.tsx`)
Mode-gated summary of value delivered, injected into the right column of the admin/supervisor dashboard (stacked below ActionRequiredPanel):
- **Standard** — returns null (hidden)
- **Assist** — compact 3-metric violet card: scheduling conflicts caught, move decisions assisted, exceptions auto-analysed
- **Optimize** — richer blue card: 3 prominent metrics (conflicts prevented, manual decisions reduced, dwell risks identified) + 2 compact rows (move prioritisation speed, carrier self-service efficiency)

Metrics are derived from real dashboard stats where possible, with clearly-framed "estimated impact" labelling.

### Final Sidebar Cleanup

Additional items demoted to `secondary: true` (dimmed, 12px text):
- Yard Setup — admin configuration, not daily ops
- Users — admin utility
- Audit Log — compliance review surface
- Lifecycle Video — also now `subtle: true` (very faint, admin only)

## UI Design System

### Enterprise Shared Components (`components/enterprise/`)

| Component | File | Purpose |
|---|---|---|
| `PageHeader` | `page-header.tsx` | Page title + subtitle + icon + action area + optional KPI strip; `divider` prop adds border-b |
| `FilterToolbar` | `filter-toolbar.tsx` | Search + filters + active filter chips + clear-all; used on all table/list pages |
| `StatusChip` | `status-chip.tsx` | Consistent colored badge for any status, takes a `colorFn` from `lib/status-colors.ts` |
| `KPICard` | `kpi-card.tsx` | Compact metric tile with label, value, trend, optional click/href |
| `DetailDrawer` | `detail-drawer.tsx` | Sheet-based right-side properties panel; `DrawerSection` + `DrawerField` for structured fields |
| `EmptyState` | `empty-state.tsx` | Consistent empty page/section state with icon, heading, description, optional CTA button; `compact` prop for embedded contexts |
| `SectionHeader` | `section-header.tsx` | Section title with optional count badge and action slot |

All exported from `components/enterprise/index.ts`.

### Status Color System (`lib/status-colors.ts`)

Functions covering all operational states:
- `visitStatusColor` — covers `arrived`, `awaiting_slot`, `queued`, `in_yard`, `at_dock`, `loading`, `unloading`, `ready_out`, `checked_out`
- `moveStatusColor`, `movePriorityColor`, `dockStatusColor`
- `severityColor` — `critical`=red, `high`=orange, `medium`=amber, `low`=slate (distinct colors)
- `exceptionStatusColor`, `appointmentStatusColor`, `roleColor`, `auditEntityColor`

### Empty State Coverage

Standardized `EmptyState` component applied across all major pages:
- `exceptions.tsx` — no active holds / no filter matches
- `appointments.tsx` — no appointments found
- `move-tasks.tsx` — jockey card view + supervisor table view (queue-aware messages)
- `yard-inventory.tsx` — no units match filter
- `notifications.tsx` — all clear, no active alerts
- `admin-users.tsx` — no users / no filter match
- `admin-carriers.tsx` — no carriers found
- `inspections.tsx` — no inspections match criteria
- `yard-audit.tsx` — no assets in queue
- `gate-guard.tsx` — appointment search returns nothing

## AI Features

The AI assistant and email intelligence use OpenAI. Connect via Replit AI Integrations (OpenAI connector) which sets `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` automatically. The system gracefully degrades if no key is configured.
