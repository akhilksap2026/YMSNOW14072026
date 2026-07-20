---
name: Phase 4 Guardrails + Ground Truth
description: Prompt discipline rules and verified codebase facts for Phase 4 work
---

## GUARDRAILS (every prompt)
- Do ONLY what the prompt's Scope (IN) lists. Do NOTHING in Scope (OUT).
- Pre-flight READ the named files BEFORE writing code. If a named path does not exist as described, STOP and report — do not invent an alternative.
- Touch ONLY files in "Files you MAY touch". Never edit "DO-NOT-MODIFY".
- Do not refactor, rename, or clean up unrelated code. No dependency bumps unless named. No schema changes unless the prompt says so.
- When done, run the Verification Gate, paste the actual output, then STOP and wait.
- If unsure, STOP and ask. Do not guess.

## PHASE 4 BEHAVIOR RULE (replaces Phase 3's zero-change rule)
- The HAPPY PATH must be unchanged: valid actions produce the same result as before.
- ONLY illegal / unsafe / duplicate / cross-tenant behavior may now be rejected (with a clear 4xx).
- If a fix would change a legitimate, valid flow, STOP and report.
- Every rejection returns a clean JSON error with an HTTP status — never a 500/crash.

## KNOWN GROUND TRUTH (verified in codebase)
- All PROPER DB access goes through `DatabaseStorage` (implements `IStorage`) in
  `replit/artifacts/api-server/src/lib/storage.ts`.
- EXCEPTIONS that bypass storage and query `db` directly:
  - `replit/artifacts/api-server/src/lib/assistant.ts` — imports `{ db }`, queries
    visits, exceptions, moveTasks, appointments, yardSlots, dockDoors, yardZones,
    inspections, yardAuditItems.
  - `replit/artifacts/api-server/src/lib/email-intelligence.ts` — getOpenAI, chat
    completions, JSON.parse of model output.
- `getOpenAI()` falls back to apiKey "placeholder" → does NOT degrade gracefully;
  throws at call time when no key is set.
- Visit status values: arrived, awaiting_slot, queued, in_yard, at_dock, loading,
  unloading, ready_out, checked_out.
- Contended write routes: /api/yard/assign-slot, /api/dock/assign, /api/dock/action,
  /api/moves/:id (claim/assign), /api/visits/:id/status.
- Generated but UNUSED validation schemas live in replit/lib/api-zod.
