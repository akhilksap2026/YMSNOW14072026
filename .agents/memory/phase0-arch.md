---
name: Phase 0 YMSNOW Multi-Tenant Architecture
description: Key decisions, constraints, and gotchas from prompts 0.0–0.4 of the YMSNOW hardening series
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
- Add `pool.end()` at the end if you want the script to exit cleanly (currently hangs on idle pool).

**Why `async_hooks` / `AsyncLocalStorage`:** Avoids threading `tenantId` through every function argument in the 2868-line `register-yms-routes.ts`. The storage proxy is the single choke-point.
