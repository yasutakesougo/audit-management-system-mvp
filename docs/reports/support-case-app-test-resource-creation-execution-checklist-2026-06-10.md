# SupportCase App-Test Resource Creation Execution Checklist - 2026-06-10

## Purpose

This checklist is the final gate before any app-test SupportCase SharePoint resource creation is considered.

It does not create SharePoint lists or libraries. It does not change permissions, run diagnostics, connect UI, migrate documents, change Graph API or `spFetch` code, or change `SupportCaseRepository` behavior.

## Required Approval

Do not create any app-test resource unless an explicit approval is given after this checklist is reviewed.

Required approval phrase:

```txt
app-test に SupportCase 用リスト / ライブラリを作成してよい
```

Without that explicit approval, stop at documentation and review.

## Source Plan

This checklist follows `docs/reports/support-case-app-test-resource-creation-plan-2026-06-10.md`.

Confirmed before this checklist:

- App-test site exists.
- SupportCase app-test resources do not exist yet.
- Production is excluded.
- Creation plan is documented.
- No app-test resources have been created yet.
- No permission changes have been made.

## Target Site Confirmation

Before any creation action, confirm:

- App-test URL: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Tenant host: `isogokatudouhome.sharepoint.com`
- Site path: `/sites/app-test`
- Production site involved: no
- Current browser, CLI, or tool context points to app-test only.

Stop if the target URL is missing, ambiguous, or production-like.

## Final Resource List

| Order | Resource key | Display title | Expected internal URL name | Type | Creation boundary |
|---:|---|---|---|---|---|
| 1 | `support_cases` | `SupportCases` | `SupportCases` | List | Basic case index only. |
| 2 | `support_case_events` | `SupportCaseEvents` | `SupportCaseEvents` | List | Audit/event metadata only. |
| 3 | `support_case_documents` | `SupportCaseDocuments` | `SupportCaseDocuments` | List | Document reference metadata only. |
| 4 | `support_case_restricted_documents` | `SupportCaseRestrictedDocuments` | `SupportCaseRestrictedDocuments` | Document Library | Restricted personal document storage boundary. |

`SupportCaseRestrictedDocuments` must be a document library and must not be created as an ordinary list.

## Creation Order

Use this order if creation is later approved:

1. `SupportCases`
2. `SupportCaseEvents`
3. `SupportCaseDocuments`
4. `SupportCaseRestrictedDocuments`

Rationale:

- Create the basic case index before related metadata.
- Create audit/event metadata before document references.
- Keep the restricted document library last so its type and permission boundary can be reviewed separately.

This checklist does not perform creation.

## Executor And Approver

Record before any creation step:

- Executor:
- Approver:
- Approval timestamp:
- Approval source:
- Cleanup owner:
- Reviewer for restricted library boundary:

Stop if executor, approver, or cleanup owner is not known.

## Restricted Library Boundary

Confirm all before any creation step:

- `SupportCaseRestrictedDocuments` is separate from `SupportCaseDocuments`.
- `SupportCaseRestrictedDocuments` is a document library.
- Restricted personal information files will not be stored in `SupportCaseDocuments`.
- Permission handling for the restricted library is reviewed separately.
- Any permission change requires a separate approval or plan.
- Diagnostics identity metadata access is reviewed before post-creation diagnostics.

Stop if the restricted library boundary is ambiguous.

## Pre-Execution Checks

All checks must be true:

- `main` and `origin/main` are aligned.
- Working tree is clean.
- App-test URL is confirmed.
- Production URL is excluded.
- Final resource list is approved.
- Creation order is approved.
- Restricted library boundary is approved.
- Field candidates and essential fields are reviewed.
- Rollback/cleanup owner is assigned.
- Explicit approval phrase is present.

## Stop Conditions

Stop immediately if any condition is true:

- Explicit approval phrase is missing.
- Target site may be production.
- App-test URL is not confirmed.
- Any resource name differs from the approved plan.
- `SupportCaseRestrictedDocuments` would be created as a list instead of a document library.
- Creation would be combined with permission changes.
- Creation would be combined with diagnostics re-run.
- Creation would be combined with UI integration.
- Creation would be combined with migration.
- Creation would be combined with Graph API or `spFetch` changes.
- Creation would be combined with `SupportCaseRepository` changes.
- Cleanup owner is unknown.

## Post-Creation Read-Only Diagnostics Conditions

After a separately approved creation step, read-only diagnostics may be planned only if:

- Created resource IDs and internal URL names are recorded.
- No production resource was touched.
- No permission change was bundled into creation unless separately approved.
- The diagnostics command is read-only.
- `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1` is explicit for the opt-in run.
- Expected checks are limited to metadata, `BaseTemplate`, and field visibility.

Expected post-creation diagnostics goals:

- `SupportCases` no longer returns 404.
- `SupportCaseDocuments` metadata is readable when intended.
- `SupportCaseEvents` metadata is readable when intended.
- `SupportCaseRestrictedDocuments` is confirmed as a document library.
- Field-level diagnostics can reach essential field checks.

Post-creation diagnostics must not connect UI, migrate documents, upload files, or change repository behavior.

## Rollback And Cleanup Record

Before creation, prepare a record for:

- Planned resource names.
- Created list/library IDs.
- Created internal URL names.
- Created type and `BaseTemplate`.
- Creation timestamp.
- Executor.
- Approval reference.
- Cleanup owner.

Do not delete anything without verifying app-test URL and resource IDs. Never apply cleanup to production.

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
