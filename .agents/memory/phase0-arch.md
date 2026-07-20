---
name: Phase 0–1 YMSNOW Multi-Tenant + Billing Architecture
description: Key decisions, constraints, and gotchas from prompts 0.0–1.4 of the YMSNOW hardening series
---

## Session auth (Prompt 0.3)
- Cookie: `ymsnow_session` httpOnly, HMAC-SHA256, format `base64url(JSON).base64url(sig)`.
- `req.auth = { userId, tenantId, role }` is attached by `auth-middleware.ts` before route handlers.
- `/auth/*` and `/healthz` are skipped by the middleware (auth.ts routes verify the cookie themselves).
- `SESSION_SECRET` env secret must be set.

## Tenant isolation (Prompt 0.4)
- `tenantContext` is an `AsyncLocalStorage<string>` exported from `storage.ts`.
- `auth-middleware.ts` calls `tenantContext.run(payload.tenantId, next)` so every db call in the same request automatically sees the right tenant.
- The `storage` export is a Proxy that reads `tenantContext.getStore()` on every property access — routes use `storage.X()` with zero import changes.
- Every `DatabaseStorage` method: SELECT adds `eq(table.tenantId, this.tenantId)`, INSERT spreads `tenantId: this.tenantId`, UPDATE strips `tenantId` from set-data and adds it to WHERE.
- Catalog tables (`roles`, `permissions`, `role_permissions`) are NOT tenant-scoped — they are global and managed separately in `rbac.ts`.

## Zod insert schemas
- All `createInsertSchema(...)` calls in `schema/index.ts` now omit `tenantId: true` so route-level `.parse(req.body)` doesn't require callers to supply it.
- The storage layer stamps `tenantId` on every DB write regardless of what the caller provides.

## Schema tenantId columns
- 24 tables have `tenantId: text().notNull().references(() => tenants.id)` (no DB default — must be provided by the storage layer, not the DB).
- Backfill script: `replit/scripts/src/backfill-tenant.ts` — do NOT re-run (data already stamped).

## RBAC (Prompt 0.4)
- `requirePermission(module, permType)` now prefers `req.auth?.role` over `x-user-role` header.
- Three routes hardened: `POST /api/gate/check-in`, `POST /api/gate/check-out` → `requirePermission("gate","canExecute")`; `PATCH /api/admin/users/:userId/role` → `requirePermission("user_mgmt","canModify")`.

## Verification
- Second tenant "Acme Corp" (slug `acme`, user `acme-admin`) created by `replit/scripts/src/verify-tenant-isolation.ts`.
- Run: `cd replit && pnpm --filter @workspace/scripts run verify-isolation`

## Billing/Entitlement catalog (Prompts 1.1–1.4)

### Schema (replit/lib/db/src/schema/billing.ts)
Five tables: `modules`, `plans`, `plan_modules`, `subscriptions`, `tenant_module_overrides`.
- Module codes: `gate`, `appointments`, `yard_inventory`, `yard_map`, `dock`, `move_tasks`, `hold_mgmt`, `ready_to_go`, `inspections`, `yard_audit`, `reports`, `user_mgmt`, `ai_copilot`.
- Plans: `core` (8 modules), `professional` (11), `enterprise` (13).
- Northwind → enterprise, Acme → core. Both active subscriptions.

### Resolver (replit/artifacts/api-server/src/lib/entitlements.ts)
- `resolveEntitlements(tenantId)` → `Record<moduleCode, {enabled, limits?}>`.
- 30 s in-memory TTL cache keyed by tenantId. `invalidateEntitlements(tenantId)` clears it.
- Logic: find subscription → if inactive → all disabled; else start from plan modules → apply non-expired tenant_module_overrides.
- `GET /api/me/entitlements` returns resolved map for `req.auth.tenantId`.

### Server-side module gate (Prompt 1.3)
- `requireModule(moduleCode)` middleware in `require-module.ts` → 403 `{error:"module_not_licensed",module}`.
- Applied as `app.use(prefix, requireModule(code))` block at top of `registerYmsRoutes()`.
- 26 prefix gates covering all 12 operational modules. Always-on: dashboard, carriers, sidebar, notifications, portal, me, admin/reset-to-seed.

### Client-side entitlement layer (Prompt 1.4)
- `replit/artifacts/yms/src/lib/entitlements.tsx`: `EntitlementsProvider`, `useEntitlements()`, `moduleEnabled()`, `<Gated module="...">`.
- `replit/artifacts/yms/src/lib/product-mode.tsx`: ceiling derived from entitlements (ai_copilot→enhanced, reports→elevate, else core). Default mode = ceiling on first load; user can downshift; upshift beyond ceiling clamped.
- Sidebar: `module?` field on `NavItem`; `CollapsibleNavGroup` filters by entitlement before role/AI checks.
- `ModuleGuard` in `App.tsx` wraps each route; redirects to `/` with toast when module not licensed.
- `/api/admin/users` and `/api/ai-config` queries gated via `enabled: moduleEnabled(...)` to prevent 403 noise.

**Why ceiling defaults to "enhanced" while loading:** prevents false restriction during the brief entitlements fetch. Once data arrives, real ceiling is applied.

**Why `async_hooks` / `AsyncLocalStorage`:** Avoids threading `tenantId` through every function argument in the 2868-line `register-yms-routes.ts`. The storage proxy is the single choke-point.

## Phase 2 — KSAP Platform Admin (Prompts 2.1–2.4)

### Platform admin identity (2.1)
- `platform_admins` table (separate from `users` — `users.tenantId` is NOT NULL).
- Session token: `{ tenantId: null, isPlatformAdmin: true }`. `authMiddleware` skips `tenantContext.run()` for platform admins.
- `requirePlatformAdmin` middleware exported from `auth-middleware.ts`.
- Login endpoint tries `users` first, then `platform_admins`. Seed account: `ksap-admin` / `admin@ksap.io`.

### Platform routes (2.2–2.4) — `routes/platform.ts`
- All `/api/platform/*` routes require `requirePlatformAdmin`; use `db` directly (never `storage`).
- Tenant CRUD: `GET/POST /tenants`, `PATCH /tenants/:id` (rename / suspend / reactivate).
- Module matrix: `GET /tenants/:id/entitlements` (source-annotated, uncached), `PUT /tenants/:id/subscription`, `PUT /tenants/:id/overrides` (full-replace semantics — send complete desired set).
- Changelog: `GET /tenants/:id/changelog`.
- `invalidateEntitlements(tenantId)` called after every subscription/override/status write.

### Entitlement source resolver (2.3)
- `resolveEntitlementsWithSource(tenantId)` in `entitlements.ts` — parallel function to `_resolve`, uncached, returns `source: "plan"|"not-in-plan"|"override-on"|"override-off"` + raw override row.
- DO NOT modify `resolveEntitlements` or `_resolve` — enforcement path must stay unchanged.

### Governance change log (2.4)
- `entitlement_changes` table in `schema/billing.ts`: `(id, actorUserId, tenantId, action, moduleCode, note, createdAt)`.
- `logChange()` helper in `platform.ts` is fire-and-catch — never throws on log failure.
- Written on: `tenant_created`, `tenant_renamed`, `tenant_suspended`, `tenant_reactivated`, `subscription_updated`, `overrides_updated`.
- Frontend: change log panel at bottom of `platform-tenant-detail.tsx`, refetches after mutations.

### Frontend platform shell (2.2–2.4)
- `PlatformAdminShell` in `App.tsx` uses `Switch/Route` from wouter: `/platform/tenants/:id` → detail page; catch-all → list.
- Pages: `platform-admin.tsx` (list + "Modules" button), `platform-tenant-detail.tsx` (plan selector + module matrix + changelog).
- `AppGate` forks on `user.isPlatformAdmin` before `AuthenticatedApp` — platform admin sees no tenant UI.
