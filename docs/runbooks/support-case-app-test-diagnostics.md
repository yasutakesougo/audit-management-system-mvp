# SupportCase App-Test Diagnostics Runbook

## Purpose

This runbook defines the safe preflight path for diagnosing experimental SupportCase SharePoint definitions in app-test before any real resource creation, permission work, UI wiring, or migration.

Use this document to review whether the existing opt-in diagnostics can see the expected SupportCase definitions, field candidates, essential fields, and restricted document library boundary. This is a human review artifact for deciding whether a later app-test creation/verification phase is safe to plan.

This runbook does not create SharePoint lists or libraries.

## Target Resources

| Resource | SharePoint title | Type | Purpose |
|---|---|---|---|
| `support_cases` | `SupportCases` | List | Basic support case index. |
| `support_case_documents` | `SupportCaseDocuments` | List | Reference metadata for standard and restricted documents. |
| `support_case_events` | `SupportCaseEvents` | List | Audit events for case/document actions. |
| `support_case_restricted_documents` | `SupportCaseRestrictedDocuments` | Document Library | Candidate isolated storage for personal information documents. |

## Safety Boundary

- SupportCase SharePoint resources are still `experimental`.
- They must not be included in the default drift probe.
- They must not be created by normal provisioning or bootstrap.
- They must be diagnostic targets only when explicitly opted in.
- Do not run this against production.
- Do not use this runbook as approval to create app-test resources.

## Preflight Checks

Run the local repository checks first:

```bash
git checkout main
git pull --ff-only
git status --short
npm run sp:audit
npx vitest run src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts
```

Confirm all of the following before running diagnostics:

- `git status --short` is empty.
- The SupportCase app-test diagnostics preflight passes.
- The current SharePoint environment is app-test, not production.
- `SHAREPOINT_SITE`, `VITE_SP_SITE_URL`, or the runtime site configuration does not point to a production site.
- SupportCase diagnostics opt-in is explicit for this command only.
- The operator understands that `SupportCaseRestrictedDocuments` is a document library boundary for personal information candidates.
- `npm run sp:audit` has no new `FAIL`. Existing unrelated warnings do not authorize proceeding if a new SupportCase drift risk appears.

## Execution Checklist

Before running any app-test diagnostics command, record the following checks in the work log or PR comment:

- `main` and `origin/main` point to the same commit.
- `git status --short` is empty.
- The target URL has been confirmed as app-test.
- The target URL has been confirmed not to be production.
- `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1` is explicit for the opt-in diagnostics command.
- Without opt-in, `support_case_*` resources do not appear as diagnostic targets.
- With opt-in, only then `support_case_*` resources appear as diagnostic targets.
- `SupportCaseRestrictedDocuments` is treated as a document library.
- The restricted library is not mixed with the standard `SupportCaseDocuments` metadata list.
- No command in this checklist creates lists, libraries, permissions, folders, files, or items.

## Opt-In Diagnostics

Default behavior must stay quiet. Without the opt-in flag, SupportCase diagnostics are skipped:

```bash
SHAREPOINT_SITE=https://<app-test-tenant>.sharepoint.com/sites/<app-test-site> \
npm run ci:integration:diagnose
```

Expected default result:

- The SupportCase diagnostic test is skipped.
- `support_case_*` resources are not included in default drift probe targets.
- No SharePoint resources are created.

Run the read-only SupportCase diagnostics only with the explicit flag:

```bash
SHAREPOINT_SITE=https://<app-test-tenant>.sharepoint.com/sites/<app-test-site> \
VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1 \
npm run ci:integration:diagnose
```

Expected opt-in result:

- `support_cases`, `support_case_documents`, `support_case_events`, and `support_case_restricted_documents` are diagnostic targets.
- The diagnostics read list/library metadata and fields only.
- Missing lists or fields are reported as diagnostics; they are not auto-created.
- `SupportCaseRestrictedDocuments` remains a document library candidate, not the same resource as `SupportCaseDocuments`.
- The lifecycle remains `experimental`.

Use the unit boundary tests when reviewing a code change around these diagnostics:

```bash
npx vitest run src/sharepoint/__tests__/driftProbeRegistry.spec.ts src/sharepoint/fields/__tests__/supportCaseFields.spec.ts
```

## Field Candidates And Essential Fields

Review field resolution with these canonical names and aliases in mind:

| Concept | Expected names/candidates |
|---|---|
| Tenant ID | `TenantId`, `tenantId` |
| Case ID | `CaseId`, `caseId`, `SupportCaseId` |
| Document ID | `DocumentId`, `documentId` |
| Document category | `Category`, `documentCategory` |
| Storage policy | `StoragePolicy`, `storagePolicy` |
| Audit log required | `AuditLogRequired`, `auditLogRequired` |
| Event type | `Action`, `eventType` |
| Occurred at | `OccurredAt`, `occurredAt` |
| Actor ID | `ActorId`, `actorId` |
| Actor name | `ActorName`, `actorName` |
| Source | `Source`, `source` |
| Deleted marker | `IsDeleted`, `isDeleted` |

Review emphasis:

- Do not accept a SupportCase document definition without tenant and case identity.
- `StoragePolicy` and `AuditLogRequired` are required boundary fields for restricted document handling.
- Personal information and restricted documents must not be treated as ordinary document metadata only.
- `SupportCaseRestrictedDocuments` must stay separate from `SupportCaseDocuments`.

## Prohibited Actions

Do not perform any of the following in this runbook or the docs-only PR that introduces it:

- Production SharePoint list or library creation.
- App-test SharePoint list or library creation.
- Permission provisioning or permission changes.
- UI integration.
- Existing folder or document migration.
- Graph API or `spFetch` communication changes.
- `SupportCaseRepository` behavior changes.
- Removing the `experimental` lifecycle.
- Permanently adding SupportCase resources to the default drift probe.
- File upload implementation.

## Stop Conditions

Stop immediately and report the finding if any of the following is true:

- The target site may be production.
- The preflight check fails.
- `support_case_*` appears in diagnostics without explicit opt-in.
- The restricted library is treated as a standard document metadata list.
- Restricted documents are treated as the same list/resource as standard document metadata.
- Essential fields are missing.
- `npm run sp:audit` reports a new `FAIL`.
- Schema drift appears outside known unrelated warnings.
- The next step would require SharePoint resource creation or permission changes.

## Rollback And Cleanup

This docs-only runbook does not modify SharePoint. Rollback for this PR is a documentation revert.

For a future app-test resource creation phase, record cleanup data before making changes:

- Planned resource names.
- Created list/library IDs.
- Created item IDs, if any test rows are later added.
- The app-test site URL used for creation.
- Evidence that the site is not production.
- Restricted library permission review status.

If deletion becomes necessary later, verify the app-test site URL and resource IDs before deleting anything. Never use production cleanup as part of this diagnostics runbook.

## Conditions For The Next Phase

Proceed to app-test resource verification only after all conditions are true:

- PR #2133 is merged.
- This runbook PR is merged.
- Opt-in diagnostics behavior has been reviewed.
- Production is confirmed unaffected.
- The restricted document library separation policy has been reviewed.

The next phase may plan app-test creation/verification, but it must still be a separate reviewed change or manual operation with explicit approval.
