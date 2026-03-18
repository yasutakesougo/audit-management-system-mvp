# 🧭 Issue: Incident SharePoint Integration (Schema → Repo → Factory → Verification)

## Background
2026-03-18 のセッションにて、以下の SharePoint 統合パターンが確立された。

### Completed Integrations
| Module             | Status                            |
| ------------------ | --------------------------------- |
| MonitoringMeetings | ✅ SharePoint integration verified |
| Handoffs           | ✅ SharePoint integration verified |

両モジュールは以下の統一パターンで実装されている。
`Schema (docs) → Field Map (zod) → SharePoint Repository → Repository Factory → UI / Hooks → Verification Runbook`

また、以下の **実行環境パターン**が確立済み。
`.env.local` 内の `VITE_SP_ENABLED=true` により、
`LocalRepository` と `SharePointRepository` が **Factory により自動切替**される。

---

## 🎯 Goal
次の機能 **Incident (ヒヤリハット / 事故報告)** を、Monitoring / Handoffs と同じ **SharePoint統合パターン**で実装する。

---

## 🧩 Target Architecture
```text
Incident
 ├─ Schema (docs/database/sp-schemas/incident-list-schema.md)
 ├─ Field Map (zod: incidentFields.ts)
 ├─ SharePoint Repository (spIncidentRepository.ts)
 ├─ Local Repository (localIncidentRepository.ts)
 ├─ Repository Factory (createIncidentRepository.ts)
 ├─ UI / Hook
 └─ Verification Runbook (incidents-verification.md)
```

---

## 📦 Step 1 — SharePoint List Schema Design
Create: `docs/database/sp-schemas/incident-list-schema.md`

Proposed list structure:

| Column          | Internal Name         | Type          |
| --------------- | --------------------- | ------------- |
| recordId        | cr016_recordId        | Text (Unique) |
| occurredAt      | cr016_occurredAt      | DateTime      |
| severity        | cr016_severity        | Choice        |
| category        | cr016_category        | Choice        |
| summary         | cr016_summary         | Note          |
| immediateAction | cr016_immediateAction | Note          |
| followUp        | cr016_followUp        | Note          |
| status          | cr016_status          | Choice        |
| reporterName    | cr016_reporterName    | Text          |
| relatedUsers    | cr016_relatedUsers    | Text          |

**Severity choices**: Low, Medium, High, Critical
**Status choices**: Open, Investigating, Closed
**Index**: cr016_recordId, cr016_occurredAt

---

## 📦 Step 2 — Field Map
Create: `src/infra/sharepoint/fields/incidentFields.ts`
Responsibilities: SP item ↔ domain object mapping, Zod validation

## 📦 Step 3 — Repository
Create: `src/infra/sharepoint/repos/spIncidentRepository.ts`
Methods: `getIncidentsByDate()`, `createIncident()`, `updateIncidentStatus()`, `updateIncidentFollowUp()`
**Rule**: `recordId` をキーに `$filter` で特定 (SharePoint内部 ID 依存を回避)

## 📦 Step 4 — Local Repository
Create: `src/features/incidents/repos/localIncidentRepository.ts` (localStorage / memory for dev)

## 📦 Step 5 — Repository Factory
Create: `src/features/incidents/repos/createIncidentRepository.ts`
Switch rule: `VITE_SP_ENABLED` (true → SharePoint, false → Local)

## 📦 Step 6 — Provisioning Script
Add to `provision/schema.xml` and create `scripts/provision-incidents-pnp.ps1`

## 📦 Step 7 — Verification
Create `docs/runbooks/incidents-verification.md`
Phases: 1(List structure) → 2(CRUD) → 3(UI integration) → 4(Edge cases)

---

## ⚙️ Current Environment & ⚠️ Important Context
**Branch**: `refactor/monitoring-repository-factory`

**Repository Pattern**: `recordId` is the primary key. All updates must use `$filter=cr016_recordId eq '...'` instead of SharePoint ID.

**Provisioning Auth (Mac)**: Use interactive login with client ID.
`Connect-PnPOnline -Url <SITE_URL> -Interactive -ClientId $env:VITE_AAD_CLIENT_ID`

---

## 📌 Success Criteria
Incident module must satisfy: Schema provisioned, CRUD verified, Local / SP switching works, UI works with SP data, Verification runbook completed.
