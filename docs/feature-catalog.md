# Feature & Domain Catalog

## Purpose

This document is the Single Source of Truth (SSOT) for the application's route structure, feature-flag state, and RBAC wiring, based on verified code analysis of the live route modules and guard implementations.

It documents both:
- **Intended Role**: the audience implied by route placement, feature ownership, or UI labeling
- **Effective Access**: the actual runtime access behavior enforced by current guards, feature flags, and authorization helpers

Where Intended Role and Effective Access differ, this document records the effective behavior explicitly so future hardening work can resolve the gap safely.

---

## RBAC Architecture

### Role Hierarchy

| Level | Role | Description |
|-------|------|-------------|
| 3 | `admin` | 管理者 — Full system access |
| 2 | `reception` | 受付 — Day-to-day operations |
| 1 | `viewer` | 閲覧者 — Read-only access |

### Resolution

Roles are resolved via Azure AD group membership in [`useUserAuthz`](../src/auth/useUserAuthz.ts):

| Env Variable | Grants Role |
|--------------|-------------|
| `VITE_AAD_ADMIN_GROUP_ID` | `admin` |
| `VITE_AAD_RECEPTION_GROUP_ID` | `reception` |
| (fallback) | `viewer` |

Route-level enforcement is provided by [`RequireAudience`](../src/components/RequireAudience.tsx).

### Current Enforcement State (2026-03-10 verified)

> [!NOTE]
> **`canAccess()` in [`roles.ts`](../src/auth/roles.ts) correctly enforces the role hierarchy:**
> `ROLE_LEVEL[role] >= ROLE_LEVEL[required]` (viewer=1 < reception=2 < admin=3).
> Combined with [`RequireAudience`](../src/components/RequireAudience.tsx), route-level role enforcement is **active**.

**Effective enforcement summary:**

| Condition | Behavior |
|-----------|----------|
| Normal production (MSAL authenticated) | `useUserAuthz` resolves role via Azure AD group membership → `canAccess()` enforces level hierarchy |
| `VITE_SKIP_LOGIN=1` or E2E mode | `RequireAudience` **bypasses** all role checks (line 22-24) — all routes accessible |
| `VITE_AAD_ADMIN_GROUP_ID` not set in PROD | Fail-closed: all users resolve to `viewer` — admin pages show 403 |
| `VITE_AAD_ADMIN_GROUP_ID` not set in DEV | Demo convenience: all users resolve to `admin` |

> [!CAUTION]
> **31 of 72 routes lack `RequireAudience` guards entirely** (see Summary table at bottom).
> These routes — including all `/daily/*`, `/handoff-timeline`, `/nurse/*` — are accessible to any authenticated user
> regardless of role. This is **intentional** for frontline staff workflows but should be reviewed before multi-facility rollout.
>
> The **Intended Role** column below shows `—` for unguarded routes. Where a role is listed, it is **actively enforced**
> via `RequireAudience` + `canAccess()` in production.

---

## Feature Flags

### Route-Gating Flags

These flags control whether entire route subtrees are accessible.

| Flag | Env Variable | Default | Gated Routes |
|------|-------------|---------|--------------|
| `schedules` | `VITE_FEATURE_SCHEDULES` | `false` | `/schedule*`, `/schedules/*`, `/admin/integrated-resource-calendar` |
| `todayOps` | `VITE_FEATURE_TODAY_OPS` | `false` | `/today` |
| `icebergPdca` | `VITE_FEATURE_ICEBERG_PDCA` | `false` | `/analysis/iceberg-pdca*` |

### UI / Behavior Flags

These flags toggle UI elements or behavior within pages but do not gate entire routes.

| Flag | Env Variable | Scope |
|------|-------------|-------|
| `staffAttendance` | `VITE_FEATURE_STAFF_ATTENDANCE` | Staff attendance UI panels |
| `complianceForm` | — | Compliance form visibility |
| `schedulesWeekV2` | — | Week view layout variant |

Source: [`featureFlags.ts`](../src/config/featureFlags.ts)

---

## Observability & Fortress Status

### Structured Logging Coverage

The following layers have been migrated from `console.*` to structured `auditLog` / `persistentLogger`:

| Layer | Status | Logger | Notes |
|-------|--------|--------|-------|
| `lib/sp/` (SharePoint client) | ✅ Complete | `auditLog` | `spFetch`, `helpers`, `spListSchema`, `spPostBatch`, `spListRead` |
| `features/handoff/` | ✅ Complete | `handoffActions.logger` | Event taxonomy: `handoff.status_update`, `handoff.comment`, `handoff.storage_*` |
| `features/today/` | ✅ Complete | `alertActions.logger` | Event: `today.briefing_action` with state transitions |
| `features/daily/` | ✅ Clean | — | No residual `console.*` calls |
| `features/schedules/` | ✅ Clean | — | No residual `console.*` calls |
| Pages / Debug / Demo | 🔶 Unclassified | — | See [`console-classification.md`](console-classification.md) |
| `lib/env.ts` / `lib/audit.ts` | ⬜ KEEP | `console.*` | Intentional: infra bootstrap / logging-about-logging |
| `worker.ts` | ⬜ KEEP | `console.*` | Cloudflare Workers context (no `auditLog` available) |

### Fortress Criteria Progress (ADR-003)

| # | Criterion | `daily` | `handoff` | `schedules` | `auth` |
|---|-----------|---------|-----------|-------------|--------|
| F1 | Unit 80%+ | 🔶 | 🔶 | 🔶 | 🔶 |
| F2 | E2E smoke | 🔶 | — | 🔶 | — |
| F3 | Error classification | ✅ | ✅ | 🔶 | 🔶 |
| F4 | ADR linked | ✅ ADR-003 | ✅ ADR-003 | ✅ ADR-003 | — |
| F5 | Observability events | ✅ | ✅ | 🔶 | 🔶 |

### Architecture Decision Records

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adr/ADR-001-archive-strategy.md) | Archive Strategy | Accepted |
| [ADR-002](adr/ADR-002-today-execution-layer-guardrails.md) | Today Execution Layer Guardrails | Accepted |
| [ADR-003](adr/ADR-003-fortress-criteria.md) | Fortress Criteria — Module Quality Gate | Accepted |
| [ADR-003b](adr/ADR-003-local-day-keying-action-telemetry.md) | Local-day Keying & Action Telemetry | Accepted |

### SharePoint List Registry

Source: [`spListRegistry.ts`](../src/sharepoint/spListRegistry.ts) — Single Source of Truth for 25 SharePoint lists.

List names are resolved via `envOr(envKey, fallback)` or `fromConfig(listKey)`, providing a deterministic fallback chain:

1. Environment variable override → 2. `LIST_CONFIG` constant → 3. Hardcoded default

| Category | Lists | Examples |
|----------|-------|---------|
| `master` | 3 | 利用者マスタ, 職員マスタ, 組織マスタ |
| `daily` | 4 | 日次支援記録, 日次活動記録, サービス提供実績, 活動日誌 |
| `attendance` | 4 | 日次出欠, 出席管理ユーザー, 日次出席詳細, 職員出勤管理 |
| `schedule` | 1 | スケジュール |
| `meeting` | 2+ | 会議セッション, 会議ステップ |

> [!NOTE]
> Full list details and env variable mappings are in [`env-reference.md`](env-reference.md) § 2.

---

## Route Modules & Domains

### 1. Dashboard

Source: [`dashboardRoutes.tsx`](../src/app/routes/dashboardRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/` | `DashboardRedirect` | — | — |
| `/auth/callback` | `AuthCallbackRoute` | — | — |
| `/dashboard` | `StaffDashboardPage` | — | — |
| `/dashboard/briefing` | `DashboardBriefingPage` | — | — |
| `/today` | `TodayOpsPage` | `viewer` | `todayOps` |
| `/room-management` | `RoomManagementPage` | — | — |
| `/meeting-guide` | `MeetingGuidePage` | — | — |
| `/compliance` | Placeholder | `viewer` | — |

---

### 2. Daily Records

Source: [`dailyRoutes.tsx`](../src/app/routes/dailyRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/daily` | → `/dailysupport` redirect | — | — |
| `/dailysupport` | `DailyRecordMenuPage` | — | — |
| `/daily/menu` | → `/dailysupport` redirect | — | — |
| `/daily/table` | `TableDailyRecordPage` | — | — |
| `/daily/activity` | `DailyRecordPage` | — | — |
| `/daily/attendance` | `AttendanceRecordPage` | — | — |
| `/daily/support` | `TimeBasedSupportRecordPage` | — | — |
| `/daily/support-checklist` | `TimeFlowSupportRecordPage` | — | — |
| `/daily/time-based` | → `/daily/support` redirect | — | — |
| `/daily/health` | `HealthObservationPage` | — | — |

> [!CAUTION]
> Daily routes have **no role guards**. All authenticated users can access all daily recording features.

---

### 3. Records & Journals

Source: [`recordRoutes.tsx`](../src/app/routes/recordRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/records` | `RecordList` | `viewer` | — |
| `/records/monthly` | `MonthlyRecordPage` | `reception` | — |
| `/records/journal` | `BusinessJournalPreviewPage` | `viewer` | — |
| `/records/journal/personal` | `PersonalJournalPage` | `viewer` | — |
| `/records/service-provision` | `ServiceProvisionFormPage` | `reception` | — |
| `/billing` | `BillingPage` | `reception` | — |
| `/handoff-timeline` | `HandoffTimelinePage` | — | — |
| `/meeting-minutes` | List | — | — |
| `/meeting-minutes/new` | New | — | — |
| `/meeting-minutes/:id` | Detail | — | — |
| `/meeting-minutes/:id/edit` | Edit | — | — |

---

### 4. Analysis

Source: [`analysisRoutes.tsx`](../src/app/routes/analysisRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/analysis` | → `/analysis/dashboard` redirect | — | — |
| `/analysis/dashboard` | `AnalysisDashboardPage` | `viewer` | — |
| `/analysis/iceberg-pdca` | `IcebergPdcaPage` | `viewer` | `icebergPdca` |
| `/analysis/iceberg-pdca/edit` | `IcebergPdcaPage` (edit) | `viewer` | `icebergPdca` |
| `/analysis/iceberg` | `IcebergAnalysisPage` | `viewer` | — |
| `/analysis/intervention` | `InterventionDashboardPage` | `viewer` | — |
| `/assessment` | `AssessmentDashboardPage` | `viewer` | — |
| `/survey/tokusei` | `TokuseiSurveyResultsPage` | `viewer` | — |

> [!NOTE]
> `IcebergPdcaGate` has an additional edit-only admin gate. In addition to the normal route-level
> `RequireAudience` checks, edit behavior is also constrained by `canAccessDashboardAudience()`,
> resulting in a second layer of enforcement for admin-only edit operations.

---

### 5. Support Plan

Source: [`supportPlanRoutes.tsx`](../src/app/routes/supportPlanRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/support-plan-guide` | `SupportPlanGuidePage` | `viewer` | — |
| `/isp-editor` | `ISPComparisonEditorPage` | — | — |
| `/isp-editor/:userId` | `ISPComparisonEditorPage` | — | — |

---

### 6. IBD / 強度行動障害

Source: [`ibdRoutes.tsx`](../src/app/routes/ibdRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/ibd` | `IBDHubPage` | — | — |
| `/ibd-demo` | `IBDDemoPage` (dev only) | — | — |

---

### 7. Schedules

Source: [`scheduleRoutes.tsx`](../src/app/routes/scheduleRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/schedule` | → `/schedules/week` redirect | `viewer` | `schedules` |
| `/schedule/*` | → `/schedules/week` redirect | `viewer` | `schedules` |
| `/schedules` | → `/schedules/week` redirect | `viewer` | `schedules` |
| `/schedules/week` | `NewSchedulesWeekPage` | `viewer` | `schedules` |
| `/schedules/day` | `SchedulesDayRedirect` | `viewer` | `schedules` |
| `/schedules/month` | `SchedulesMonthRedirect` | `viewer` | `schedules` |
| `/schedules/timeline` | `SchedulesTimelineRedirect` | `viewer` | `schedules` |
| `/schedules/unified` | → `/schedules/week` redirect | `viewer` | `schedules` |
| `/schedules/create` | → `/schedules/week` redirect | — | — |
| `/dev/schedule-create-dialog` | Dev harness | `viewer` | `schedules` |

> [!NOTE]
> All schedule routes are **triple-gated**: `SchedulesGate` → `ProtectedRoute(flag=schedules)` → `RequireAudience(viewer)`.

---

### 8. Admin

Source: [`adminRoutes.tsx`](../src/app/routes/adminRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/admin/dashboard` | `AdminDashboardPage` | `admin` | — |
| `/checklist` | `ChecklistPage` | `admin` | — |
| `/audit` | `AuditPanel` | `admin` | — |
| `/users` | `UsersPanel` | `admin` | — |
| `/users/:userId` | `UserDetailPage` | `admin` | — |
| `/staff` | `StaffPanel` | `admin` | — |
| `/staff/attendance` | `StaffAttendanceInput` | `reception` | — |
| `/admin/templates` | `SupportActivityMasterPage` | `admin` | — |
| `/admin/step-templates` | `SupportStepMasterPage` | `admin` | — |
| `/admin/individual-support/:userCode?` | `IndividualSupportManagementPage` | `admin` | — |
| `/admin/staff-attendance` | `StaffAttendanceAdminPage` | `reception` | — |
| `/admin/integrated-resource-calendar` | `IntegratedResourceCalendarPage` | `admin` | `schedules` |
| `/admin/navigation-diagnostics` | `NavigationDiagnosticsPage` | `admin` | — |
| `/admin/data-integrity` | `DataIntegrityPage` | `admin` | — |
| `/admin/csv-import` | `CsvImportPage` | `admin` | — |
| `/admin/mode-switch` | `ModeSwitchPage` | `admin` | — |
| `/admin/debug/smoke-test` | Dev only | — | — |
| `/admin/debug/zod-error` | Dev only | — | — |

---

### 9. Nurse (standalone module)

Source: [`NurseRoutes.tsx`](../src/features/nurse/routes/NurseRoutes.tsx)

| Path | Page | Intended Role | Flag |
|------|------|---------------|------|
| `/nurse` | → `/nurse/observation` redirect | — | — |
| `/nurse/observation` | `NurseObservationPage` | — | — |

> [!CAUTION]
> Nurse routes have **no role guards or feature flags**.

> [!NOTE]
> **Drift note:** `appRoutePaths.ts` currently contains phantom path entries (e.g. `users/new`,
> `staff/new`, `staff/:staffId`, `analysis/iceberg-standalone`) that do not map 1:1 to actual live
> route declarations. Conversely, some live routes (e.g. `admin/data-integrity`) are missing from
> the registry. The route tables in this catalog are based on verified route-module code, not the
> registry alone.

---

## Feature Modules (38)

| Module | Files | Primary Domain |
|--------|-------|----------------|
| `accessibility` | 4 | UI accessibility |
| `analysis` | 11 | Data analysis & dashboards |
| `assessment` | 10 | User assessment tools |
| `attendance` | 33 | Check-in/out & transport |
| `audit` | 13 | Audit trail & compliance |
| `auth` | 15 | Authentication diagnostics |
| `billing` | 4 | Billing / 国保連 |
| `compliance-checklist` | 4 | Compliance forms |
| `cross-module` | 7 | Shared cross-feature utilities |
| `daily` | 123 | Daily support records (TBS, wizard) |
| `dailyOps` | 8 | Today Flow rapid input |
| `dashboard` | 83 | Staff dashboard, briefing |
| `demo` | 3 | Demo mode |
| `diagnostics` | 8 | System diagnostics |
| `handoff` | 46 | Shift handoff timeline |
| `ibd` | 81 | Intensive behavior (氷山モデル, PDCA) |
| `import` | 10 | CSV data import |
| `kokuhoren-csv` | 6 | 国保連 CSV generation |
| `kokuhoren-preview` | 1 | 国保連 preview |
| `kokuhoren-validation` | 5 | 国保連 data validation |
| `meeting` | 20 | Meeting management |
| `meeting-minutes` | 13 | Meeting minutes CRUD |
| `nurse` | 52 | Nursing observation (vitals) |
| `official-forms` | 4 | Official form templates |
| `operation-hub` | 3 | Operation hub |
| `org` | 5 | Organization settings |
| `planDeployment` | 2 | Plan deployment |
| `records` | 18 | Record list & search |
| `reports` | 5 | Report generation |
| `resources` | 15 | Resource management |
| `schedules` | 78 | Schedule CRUD (week/day/month) |
| `service-provision` | 13 | Service provision records |
| `settings` | 17 | App settings |
| `shared` | 4 | Shared feature utilities |
| `staff` | 32 | Staff management |
| `support-plan-guide` | 33 | Support plan (ISP) editor |
| `today` | 43 | Today ops continuous input |
| `users` | 50 | User (利用者) management |

---

## Summary

| Metric | Count |
|--------|-------|
| Feature modules | 38 |
| Route modules | 9 (8 domain + nurse) |
| Total routes | 72 (including redirects & dev-only) |
| Roles defined | 3 (`viewer`, `reception`, `admin`) |
| Route-gating feature flags | 3 |
| UI/behavior feature flags | 3 |
| Routes with `RequireAudience` guard | 41 |
| Routes without role guard | 31 |
