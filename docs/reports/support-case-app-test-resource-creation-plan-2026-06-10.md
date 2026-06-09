# SupportCase App-Test Resource Creation Plan - 2026-06-10

## Purpose

This plan defines what would need to be created in app-test for experimental SupportCase SharePoint resources after administrator verification confirmed that the app-test site exists and the SupportCase lists/libraries do not exist yet.

This document is a plan only. It does not create SharePoint resources, change permissions, run diagnostics, connect UI, migrate documents, change Graph API or `spFetch` code, or change `SupportCaseRepository` behavior.

## Source Evidence

Related records:

- `docs/reports/support-case-app-test-diagnostics-result-2026-06-09.md`
- `docs/reports/support-case-app-test-diagnostics-404-403-classification-2026-06-09.md`
- `docs/reports/support-case-app-test-admin-verification-checklist-2026-06-09.md`
- `docs/reports/support-case-app-test-admin-verification-result-2026-06-10.md`

Confirmed:

- App-test site exists: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Production is excluded.
- SupportCase app-test lists/libraries are not created yet.
- No app-test or production SharePoint resource was created or changed during verification.

## Planned Resources

| Resource key | Display title | Expected internal URL name | Type | Purpose |
|---|---|---|---|---|
| `support_cases` | `SupportCases` | `SupportCases` | List | Basic support case index. |
| `support_case_documents` | `SupportCaseDocuments` | `SupportCaseDocuments` | List | Standard and restricted document reference metadata. |
| `support_case_events` | `SupportCaseEvents` | `SupportCaseEvents` | List | Audit events for case and document actions. |
| `support_case_restricted_documents` | `SupportCaseRestrictedDocuments` | `SupportCaseRestrictedDocuments` | Document Library | Isolated candidate storage for personal information documents. |

The restricted resource must be a document library, not an ordinary SharePoint list.

## Registry Alignment

Expected diagnostics/env mapping:

- `VITE_SP_LIST_SUPPORT_CASES` -> `SupportCases`
- `VITE_SP_LIST_SUPPORT_CASE_DOCUMENTS` -> `SupportCaseDocuments`
- `VITE_SP_LIST_SUPPORT_CASE_EVENTS` -> `SupportCaseEvents`
- `VITE_SP_LIBRARY_SUPPORT_CASE_RESTRICTED_DOCUMENTS` -> `SupportCaseRestrictedDocuments`

If app-test creation uses different titles or internal URL names, update the plan before any creation and review whether env overrides are required. Do not create resources with names that diverge from the registry expectation without explicit review.

## Resource Type Requirements

| Resource | Required SharePoint type | Required condition |
|---|---|---|
| `SupportCases` | List | Must not be a document library. |
| `SupportCaseDocuments` | List | Must remain metadata-only and separate from restricted file storage. |
| `SupportCaseEvents` | List | Must remain an audit/event list. |
| `SupportCaseRestrictedDocuments` | Document Library | Must use document library semantics, preferably `BaseTemplate=101`. |

Stop if `SupportCaseRestrictedDocuments` cannot be created as a document library or if restricted files would be mixed into `SupportCaseDocuments`.

## Field And Candidate Review Before Creation

Before any creation PR or manual operation, review field candidates and essential fields against the experimental definitions:

- Tenant/case identity fields such as `TenantId`, `CaseId`, and `SupportCaseId`.
- Document identity and category fields such as `DocumentId` and `Category`.
- Restricted boundary fields such as `StoragePolicy`, `LibraryTarget`, `Sensitivity`, and `AuditLogRequired`.
- Event/audit fields such as `EventId`, `Action`, `ActorId`, and `OccurredAt`.
- Deleted marker fields such as `IsDeleted`, where applicable.

Creation must not proceed if tenant/case identity, restricted document boundary fields, or audit-required fields are unresolved.

## Restricted Library Permission Boundary

`SupportCaseRestrictedDocuments` must be reviewed separately from the other SupportCase resources.

Before creation:

- Confirm whether the restricted library should inherit app-test site permissions at creation time.
- Confirm whether unique permissions are required immediately after creation.
- Confirm who can view metadata.
- Confirm who can view files.
- Confirm whether the diagnostics identity should read metadata for this library.
- Confirm that restricted personal information documents must not be stored in `SupportCaseDocuments`.

This plan does not grant permissions. If permission changes are needed, they require a separate reviewed plan or explicit approval.

## Pre-Creation Checklist

All items must be true before a creation step is proposed:

- `main` and `origin/main` are aligned.
- Working tree is clean.
- App-test URL is confirmed.
- Production URL is excluded.
- Resource names and types are approved.
- Registry/env mapping is approved.
- Field candidates and essential fields are reviewed.
- Restricted library boundary is reviewed.
- Rollback/cleanup owner is identified.
- A human reviewer explicitly approves moving from planning to app-test creation.

## Stop Conditions

Stop and do not create resources if any condition is true:

- Production site is involved or ambiguous.
- App-test site URL is not confirmed.
- Resource display title or internal URL name is not approved.
- `SupportCaseRestrictedDocuments` document library type is not approved.
- Restricted library permission boundary is not approved.
- Tenant/case identity fields are unresolved.
- `StoragePolicy` or `AuditLogRequired` expectations are unresolved.
- The next step combines list/library creation with permission changes.
- The next step combines creation with UI integration, migration, Graph API changes, `spFetch` changes, or `SupportCaseRepository` changes.
- Rollback/cleanup ownership is unclear.

## Rollback And Cleanup Planning

Before any app-test creation step, record:

- Planned resource names.
- Creation operator.
- Creation timestamp.
- Created list/library IDs.
- Created internal URL names.
- Whether any permissions were changed.
- Cleanup owner.

If cleanup is needed later, verify app-test URL and resource IDs before deleting anything. Never apply cleanup steps to production.

## Required Follow-Up Before Creation

The next step after this planning document is not automatic creation. A separate explicit approval is required.

Recommended follow-up options:

- Review this creation plan and keep SupportCase app-test rollout paused.
- Create a separate app-test resource creation PR or manual runbook with explicit approval.
- Create a separate permission review plan for `SupportCaseRestrictedDocuments`.

## Still Out Of Scope

- App-test list or library creation.
- Production SharePoint changes.
- Permission provisioning or permission changes.
- Diagnostics re-run.
- UI integration.
- Existing folder or document migration.
- Graph API or `spFetch` communication changes.
- `SupportCaseRepository` changes.
- File upload.
- Provisioning, bootstrap, setup, migration, create, ensure, or delete commands.
