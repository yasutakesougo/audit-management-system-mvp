# ADR-002: RBAC enablement, Audit logging coverage, and Data Contract alignment

Date: 2025-10-16

## Status
Accepted

## Context
- We introduced feature-gated RBAC guards, expanded audit logging (including before/after payloads), and observed naming casing differences between provisioned SharePoint lists and TypeScript mappings.
- Daily records have a minimal MVP list (`SupportRecord_Daily`) while a richer Daily type exists for future capabilities.

## Decisions
1) RBAC
- Keep RBAC disabled by default. Enable via `VITE_FEATURE_RBAC=1` for verification.
- Provide a dev-only role switcher in the header to simulate `Admin / Manager / Staff / Viewer` without identity plumbing.

2) Audit logging
- Standardize success/failure logging through a small `withAudit()` helper. Continue to emit legacy `pushAudit` where already present for backward compatibility.
- `$batch` sync includes `before_json` as an optional column. Entry hash remains based on `after_json` for idempotent duplicates.

3) Users_Master field casing
- Provisioned fields may be lowercase (e.g., `furigana`, `email`, `phone`, `isActive`).
- App remains tolerant:
  - Write: when upserting via `toUserItem()`, output both PascalCase and lowercase keys.
  - Read: SELECT includes lowercase aliases; mappers fall back to lowercase where relevant.
- We do not change existing FIELD_MAP identifiers to avoid churn.

4) Daily schema strategy
- MVP: `SupportRecord_Daily` remains a minimal list with `Title`, `cr013_recorddate`, `cr013_specialnote`.
- Future: richer Daily list/types are preserved separately (e.g., `ActivityDiary` flow). No forced unification now.

## Consequences
- RBAC can be verified locally without affecting production flows.
- Audit logs are more complete and resilient to failures; duplicates are still idempotent.
- Users list casing mismatches no longer break core CRUD paths.
- Daily features ship on a minimal list, while leaving room for future expansion.

## How to verify
1. RBAC: set `VITE_FEATURE_RBAC=1`, run dev, switch roles from the header, confirm route access.
2. Audit: create/update items to see `*_SUCCESS/FAIL`, then sync via `$batch`.
3. Users: CRUD remains functional regardless of casing in list fields.
4. Daily: `SupportRecord_Daily` read/write works with minimal schema.

