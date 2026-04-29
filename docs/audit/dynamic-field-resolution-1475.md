# Audit: Dynamic Field-Resolution Inventory (#1475)

This document summarizes the current state of dynamic field resolution (Drift Tolerance) across the codebase. 

## 1. Inventory & Classification

| Module | Component / File | Resolver Mechanism | Drift Tolerance | Self-Healing | Observability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Attendance** | `DataProviderAttendanceRepository.ts` | `AttendanceSchemaResolver` | ✅ High (CANDIDATES used) | ✅ Yes (`ensureListExists`) | ✅ `reportResourceResolution` |
| **Monitoring** | `DataProviderMonitoringMeetingRepository.ts` | `MonitoringMeetingSchemaResolver` | ✅ High (CANDIDATES used) | ✅ Yes (`ensureListExists`) | ✅ `reportResourceResolution` |
| **User** | `DataProviderUserRepository.ts` / `UserFieldResolver.ts` | `UserFieldResolver` | ✅ High (CANDIDATES used) | ⚠️ Best-effort fallback | ✅ `auditLog.info` |
| **User (SP)** | `SharePointUserRepository.ts` | Manual `resolveInternalNamesDetailed` | ✅ High + Tiered Fallback | ⚠️ No | ❌ No |
| **User (REST)**| `RestApiUserRepository.ts` | Reactive (Retry-on-400) | ✅ High (Adaptive) | ✅ Yes (Field Dropping) | ✅ `auditLog.warn` |
| **ISP (PlanGoal)** | `ispRepo.ts` | Manual `resolveInternalNamesDetailed` | ✅ Medium | ❌ No | ❌ No |
| **Transport** | `transportRepo.ts` | Manual `resolveInternalNamesDetailed` | ✅ Medium | ❌ No | ❌ No |
| **ServiceProvision** | `DataProviderServiceProvisionRepository.ts` | Manual `resolveInternalNamesDetailed` | ✅ Medium | ❌ No | ✅ `reportResourceResolution` |
| **Handoff** | `useCreateHandoffFromExternalSource.ts` | Static `FIELD_MAP_HANDOFF` | ❌ No | ❌ No | ❌ No |

## 2. Technical Patterns

### 2.1. Standard Resolver Pattern (High Maturity)
- **Logic**: Encapsulates `resolveInternalNamesDetailed` and `reportResourceResolution` in a class.
- **Benefits**: Centralized caching, consistent error handling, and telemetry integration.
- **Example**: `AttendanceSchemaResolver`.

### 2.2. Manual Resolution Pattern (Medium Maturity)
- **Logic**: Calls `resolveInternalNamesDetailed` directly within the repository methods.
- **Benefits**: Low overhead, but leads to duplication of resolution logic (select building, filtering).
- **Example**: `ispRepo.ts`.

### 2.3. Reactive Adaptation Pattern (Adaptive Maturity)
- **Logic**: Does not probe upfront. If a query or write fails with 400 (missing field), it retries with a reduced field set or without `$select`.
- **Benefits**: Extremely resilient to unanticipated schema changes without needing explicit candidate lists for every field (though still better with them).
- **Example**: `RestApiUserRepository.ts`.

### 2.4. Legacy / Naive Pattern (Low Maturity)
- **Logic**: Uses a static `FIELD_MAP` or `existingFields.has`.
- **Risks**: High vulnerability to field drift (e.g., numeric suffixes or case mismatches).
- **Example**: `Handoff`.

## 3. Migration Plan (Migration Order)

1.  **Handoff Module (Priority: High)**:
    - Transition `useCreateHandoffFromExternalSource.ts` to use `resolveInternalNamesDetailed` with `HANDOFF_CANDIDATES`.
    - Eliminate static `FIELD_MAP_HANDOFF` usage for resolution.
2.  **ISP / Transport / ServiceProvision (Priority: Medium)**:
    - Standardize manual calls into a common `SchemaResolver` pattern or ensure consistent telemetry (`reportResourceResolution`).
3.  **UserFieldResolver Hardening (Priority: Medium)**:
    - Improve the "Best-effort fallback" to be more explicit about when it's using a fallback vs. a resolved field.
4.  **Self-Healing Expansion (Priority: Low)**:
    - Implement `ensureListExists` hooks for all accessory lists in `User` and `ServiceProvision`.

## 4. Blockers & Risks

- **Handoff Write Path**: Handoff creation relies on `toSpHandoffCreatePayload` which uses static mapping. If the field is drifted, creation might fail with 400.
- **Empty List Edge Case**: Many resolvers fall back to the first candidate if the list is empty (0 fields found). This is safe for creation but might be misleading during initial setup audits.
- **Observability Gaps**: Modules without `reportResourceResolution` are "invisible" to the drift-ledger diagnostics.

---
*Created by Antigravity on 2026-04-29*
