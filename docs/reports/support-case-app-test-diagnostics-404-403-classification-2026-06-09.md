# SupportCase App-Test Diagnostics 404/403 Classification - 2026-06-09

## Purpose

This note classifies the 404 and 403 outcomes observed during the SupportCase app-test read-only diagnostics run.

It is intentionally not a creation plan and not a permission-change plan. The goal is to avoid misreading the diagnostics result before any app-test list/library creation or permission review is planned.

## Source Result

Recorded in `docs/reports/support-case-app-test-diagnostics-result-2026-06-09.md`:

| Target | HTTP status | Observed result |
|---|---:|---|
| `support_cases` / `SupportCases` | 404 | List/library was not found at the app-test site. |
| `support_case_documents` / `SupportCaseDocuments` | 403 | Access denied for metadata read. |
| `support_case_events` / `SupportCaseEvents` | 403 | Access denied for metadata read. |
| `support_case_restricted_documents` / `SupportCaseRestrictedDocuments` | 403 | Access denied for metadata read. |

The read-only diagnostics confirmed default exclusion and explicit opt-in target inclusion, but field-level diagnostics were not reached for SupportCase resources.

## `SupportCases` 404 Classification

The `SupportCases` 404 means the diagnostics user could not resolve a list or library by the configured title at the confirmed app-test site.

Candidate causes:

- The `SupportCases` app-test list has not been created yet.
- The list exists under a different display title or internal URL name.
- The diagnostics target title does not match the actual app-test SharePoint resource name.
- The diagnostics command pointed at the correct tenant but the wrong site collection or subsite.
- The registry definition, env override, or runbook expectation differs from the app-test naming convention.

Do not infer from this 404 alone that creation is approved. It only means the current read-only lookup did not find the expected title.

## SupportCase 403 Classification

The 403 responses for `SupportCaseDocuments`, `SupportCaseEvents`, and `SupportCaseRestrictedDocuments` mean the diagnostics user could not read metadata for those configured titles.

Candidate causes:

- The list or library exists, but the diagnostics user lacks read permission.
- The resource may be hidden from the current user, so existence cannot be confirmed through this read-only request.
- App-test permissions may not include the diagnostics identity.
- The resource may have unique permissions separate from the app-test site.
- `SupportCaseRestrictedDocuments` may have library-specific restrictions that differ from ordinary list metadata.
- A stale auth state could produce misleading access failures, though the same run successfully read current user and `Staff_Master` endpoints.

Do not infer from these 403 responses alone that the resources definitely exist. A permission-denied response blocks existence, type, `BaseTemplate`, and field confirmation for the current identity.

## What Is Confirmed

- The app-test site URL was reachable.
- The diagnostics identity could read current user information.
- The diagnostics identity could read `Staff_Master` metadata and one item.
- SupportCase diagnostics remained excluded by default.
- SupportCase diagnostics targets appeared only with `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1`.
- No app-test or production SharePoint resource was created, changed, deleted, provisioned, bootstrapped, migrated, or granted permissions.

## What Is Not Confirmed

- Whether `SupportCases` should be created, renamed, or mapped to an existing app-test resource.
- Whether `SupportCaseDocuments`, `SupportCaseEvents`, or `SupportCaseRestrictedDocuments` actually exist.
- Whether `SupportCaseRestrictedDocuments` is a SharePoint document library in app-test.
- Whether essential fields exist on any SupportCase resource in app-test.
- Whether any permission change is appropriate.
- Whether app-test resource creation should proceed.

## Next Checks Before Any Creation Or Permission Work

These are human review checks, not commands to create or modify SharePoint:

- Confirm the authoritative app-test site URL with an app-test administrator.
- Confirm whether the four SupportCase resources already exist.
- Confirm actual display titles, internal names, URLs, and list/library IDs if resources exist.
- Confirm whether `SupportCaseRestrictedDocuments` is intended to be a document library with `BaseTemplate=101`.
- Confirm whether `SupportCaseDocuments` and `SupportCaseRestrictedDocuments` have different permission models.
- Confirm the diagnostics identity and its intended read access level.
- Confirm whether an env override is needed for any app-test title mismatch.
- Confirm whether the next step is a permission review, a naming correction, or a separate app-test creation plan.

## Stop Conditions

Stop before planning any app-test creation or permission change if any condition is true:

- The 404 and 403 causes are still unclassified.
- The app-test administrator has not confirmed the target site and resource inventory.
- The production/app-test boundary is ambiguous.
- The expected SharePoint titles or internal names are not agreed.
- The restricted library permission model is not agreed.
- `SupportCaseRestrictedDocuments` could be mixed with ordinary document metadata.
- Field candidate and essential field expectations are not reviewed.
- Any proposed next step requires production access.
- Any proposed next step combines creation, permission changes, UI integration, migration, or repository behavior changes into one PR.

## Still Out Of Scope

- App-test list or library creation.
- Production SharePoint changes.
- Permission provisioning or permission changes.
- UI integration.
- Existing folder or document migration.
- Graph API or `spFetch` communication changes.
- `SupportCaseRepository` changes.
- File upload.
- Provisioning, bootstrap, setup, migration, create, ensure, or delete commands.

## Recommended Next Decision

Hold on creation and permission changes. First obtain app-test administrator confirmation for resource existence, naming, type, and intended permissions, then decide whether the next reviewed step should be:

- a naming/env override correction,
- an app-test permission review,
- or a separate app-test resource creation plan.
