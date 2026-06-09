# SupportCase App-Test Admin Verification Checklist - 2026-06-09

## Purpose

This checklist defines the administrator confirmations needed after the SupportCase app-test diagnostics returned one 404 and three 403 responses.

It is not a SharePoint creation plan and not a permission-change plan. It exists to decide what must be verified before any separate app-test creation, permission review, or naming correction is proposed.

## Source Findings

Recorded source reports:

- `docs/reports/support-case-app-test-diagnostics-result-2026-06-09.md`
- `docs/reports/support-case-app-test-diagnostics-404-403-classification-2026-06-09.md`

Observed app-test diagnostics result:

| Resource key | Expected title | Status | Admin verification need |
|---|---|---:|---|
| `support_cases` | `SupportCases` | 404 | Confirm existence, title, URL name, and site. |
| `support_case_documents` | `SupportCaseDocuments` | 403 | Confirm existence and whether diagnostics user should have read access. |
| `support_case_events` | `SupportCaseEvents` | 403 | Confirm existence and whether diagnostics user should have read access. |
| `support_case_restricted_documents` | `SupportCaseRestrictedDocuments` | 403 | Confirm library type, existence, and restricted permission policy. |

## App-Test Site Confirmation

Admin confirmation required:

- The authoritative app-test site is `https://isogokatudouhome.sharepoint.com/sites/app-test`.
- The site is not production.
- The SupportCase resources, if present, are intended to live on this app-test site.
- No production site, production list, or production library is part of this review.

Stop if the app-test site or production boundary is ambiguous.

## Resource Inventory Confirmation

For each SupportCase resource, the administrator should confirm:

- Whether the resource exists.
- SharePoint display title.
- Internal URL name.
- List or library ID.
- Type: list or document library.
- `BaseTemplate`, if visible.
- Whether the resource has unique permissions.
- Whether the diagnostics identity should be able to read metadata.

Expected inventory checks:

| Resource | Expected type | Required confirmation |
|---|---|---|
| `SupportCases` | List | Confirm whether the 404 means missing resource, title mismatch, site mismatch, or hidden/unreadable resource. |
| `SupportCaseDocuments` | List | Confirm whether the 403 means existing resource with insufficient read access or another visibility issue. |
| `SupportCaseEvents` | List | Confirm whether the 403 means existing resource with insufficient read access or another visibility issue. |
| `SupportCaseRestrictedDocuments` | Document library | Confirm it is a document library, preferably `BaseTemplate=101`, and not an ordinary list. |

## Naming Alignment Confirmation

Confirm the diagnostics target names against actual app-test SharePoint names:

- `VITE_SP_LIST_SUPPORT_CASES` / expected default `SupportCases`.
- `VITE_SP_LIST_SUPPORT_CASE_DOCUMENTS` / expected default `SupportCaseDocuments`.
- `VITE_SP_LIST_SUPPORT_CASE_EVENTS` / expected default `SupportCaseEvents`.
- `VITE_SP_LIBRARY_SUPPORT_CASE_RESTRICTED_DOCUMENTS` / expected default `SupportCaseRestrictedDocuments`.

If a resource exists under a different title, record whether the next step should be:

- an environment override,
- a registry/runbook naming correction,
- or a separate app-test resource creation plan.

Do not rename or create resources as part of this checklist.

## Permission Confirmation

For the diagnostics identity, confirm:

- Current user identity used by diagnostics.
- Whether the identity should have read access to each SupportCase resource.
- Whether `SupportCaseDocuments` and `SupportCaseEvents` inherit app-test site permissions or have unique permissions.
- Whether `SupportCaseRestrictedDocuments` has intentionally stricter permissions.
- Whether reading list/library metadata is allowed without reading sensitive content.

Do not grant permissions as part of this checklist.

## Restricted Library Boundary Confirmation

Confirm the restricted personal document boundary before any creation or permission planning:

- `SupportCaseRestrictedDocuments` is separate from `SupportCaseDocuments`.
- Restricted personal information documents must not be stored as ordinary document metadata only.
- The restricted resource is intended to be a document library, not a standard SharePoint list.
- The restricted library permission policy is reviewed by an administrator before any diagnostics identity is granted access.
- The restricted library does not get bundled into a general permission change for all SupportCase resources.

Stop if the restricted library could be mixed with ordinary document metadata or if its permission model is not agreed.

## Approval Conditions Before Any Next Step

Do not proceed to app-test creation, permission review implementation, or naming correction until all required confirmations are recorded:

- App-test site confirmed.
- Production boundary confirmed.
- Resource existence or absence confirmed.
- Actual display titles and internal names confirmed.
- Resource type confirmed for each target.
- `SupportCaseRestrictedDocuments` document-library boundary confirmed.
- Diagnostics identity and intended read access confirmed.
- Next step type selected: naming/env correction, permission review, or separate creation plan.
- Reviewer confirms the next step remains scoped and does not combine creation, permissions, UI, migration, or repository changes.

## Stop Conditions

Stop and keep SupportCase app-test rollout paused if any condition is true:

- App-test administrator confirmation is missing.
- Any resource's existence or title is unknown.
- `SupportCaseRestrictedDocuments` type is unknown or not a document library.
- Restricted library permissions are not reviewed.
- The diagnostics identity is not approved for metadata reads.
- The next step would require production access.
- The next step would combine app-test creation with permission changes.
- The next step would include UI integration, migration, Graph API changes, `spFetch` changes, or `SupportCaseRepository` changes.

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

## Recommended Output From Admin Review

Record the review result in a follow-up docs-only note:

- Confirmed app-test site URL.
- Confirmed diagnostics identity.
- Per-resource existence status.
- Per-resource title, internal URL name, ID, and type.
- Per-resource permission inheritance or unique permission status.
- Restricted library boundary decision.
- Recommended next step and explicit out-of-scope boundaries.
