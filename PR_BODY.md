## Summary
Apply the ADR-014 SharePoint SSOT drift contract to **MonitoringMeeting**, unifying schema resolution across fields, repository read/write, diagnostics, and tests.

## Why
MonitoringMeeting had drift-handling gaps between schema resolution, persistence paths, and health diagnostics, which could allow drifted SharePoint environments to read partially successfully while still failing to persist updates reliably.
This PR standardizes the same SSOT drift contract already established in Users / Daily / ActivityDiary.

## Scope
- Domain: MonitoringMeeting
- Layers: fields / resolver / repository / diagnostics / tests
- Out of scope: global type cleanup unrelated to MonitoringMeeting drift hardening

## Changes
### 1. Fields (SSOT)
- Updated `monitoringMeetingFields.ts`:
  - Added/expanded `MONITORING_MEETING_CANDIDATES`
  - Added `MONITORING_MEETING_ESSENTIALS` and `MONITORING_MEETING_OPTIONALS`
  - Added aliases for suffix (`Field0`), `_x0020_`, and legacy names
  - Added `buildMonitoringMeetingSelectFields` and mapping-related types
- Updated `fields/index.ts` exports to keep SSOT access consistent.

### 2. Schema Resolver
- Added `MonitoringMeetingSchemaResolver`:
  - Uses `resolveInternalNamesDetailed`
  - Applies essentials check
  - Resolves list via catalog first, then direct probe fallback
  - Keeps best-effort fallback with `resolved[key] ?? primary`
  - Emits warn logs for drift and optional missing
  - Returns resolved select list for safe query projection

### 3. Repository (Read/Write)
- Refactored `DataProviderMonitoringMeetingRepository` to mapping-first:
  - Unified read/write to `mapping[key] ?? primary`
  - Removed static physical internal-name dependency
  - Ensured payload construction uses resolved mapping
  - Uses resolver-provided select fields and list title
  - Preserves fail-open/self-healing flow

### 4. Diagnostics
- Updated `HealthPage` drift wiring:
  - MonitoringMeeting diagnostics now use SSOT candidates
  - MonitoringMeeting essentials are derived from SSOT and reflected in health required fields

### 5. Tests
- Updated drift spec:
  - alias
  - suffix
  - `_x0020_`
  - essentials boundary
  - unresolved -> missing (no silent drop)
- Added resolver spec:
  - catalog path
  - direct probe fallback
  - essential missing
  - best-effort fallback (no silent drop)

## Verification
- `npx vitest run src/sharepoint/fields/__tests__/monitoringMeetingFields.drift.spec.ts src/features/monitoring/data/modules/__tests__/MonitoringMeetingSchemaResolver.spec.ts`
  - 2 files, 23 tests passed
- `npx vitest run src/features/monitoring/repositories/__tests__/createMonitoringMeetingRepository.spec.ts src/features/monitoring/repositories/__tests__/createMonitoringMeetingRepository.phase3.spec.ts src/features/diagnostics/health/__tests__/toAdminSummary.spec.ts`
  - 3 files, 26 tests passed
- `npm run -s typecheck`
  - passed
- No new MonitoringMeeting / HealthPage-origin typecheck errors

## Review Focus
- Repository now intentionally uses mapping-first everywhere (`mapping[key] ?? primary`).
- Resolver returns best-effort mapping for unresolved optional fields by design (no silent drop).
- Health essentials for monitoring are now SSOT-driven instead of registry-only interpretation.

## Residual Risks
- If optional fields are physically absent, best-effort fallback can still produce write-time 400 in heavily drifted tenants.
- This is an intentional fail-visible trade-off to avoid silent data loss and keep unresolved schema issues diagnosable.

## PR Title
`fix(monitoring-meeting): unify SharePoint drift resolution across read/write/diagnostics`

## Template Feedback (v1)
1. 書きづらかった箇所:
2. レビュアーが迷った箇所:   <!-- 必須 -->
3. 削れる/統合できる箇所:
