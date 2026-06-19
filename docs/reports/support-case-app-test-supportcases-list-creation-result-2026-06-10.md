# SupportCase App-Test SupportCases List Creation Result - 2026-06-10

## Scope

This report records the approved creation of the `SupportCases` list in the app-test SharePoint site.

Only the `SupportCases` list was created. No other SupportCase list or library was created. No production SharePoint resource, permission, UI, migration, Graph API, `spFetch`, or `SupportCaseRepository` change was made.

## Preconditions

- Branch before execution: `main`.
- Working tree before execution: clean.
- `HEAD` and `origin/main` were aligned before execution.
- Target site: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Explicit approval existed for app-test SupportCase resource creation.
- This execution was limited to the first resource: `SupportCases`.

## Target

| Property | Value |
|---|---|
| SharePoint site | `https://isogokatudouhome.sharepoint.com/sites/app-test` |
| Resource key | `support_cases` |
| Display title | `SupportCases` |
| Expected internal URL name | `SupportCases` |
| Type | List |
| BaseTemplate | `100` |

## Execution Summary

The first script attempt failed locally before connecting to SharePoint because stdin TypeScript syntax was not accepted by the runner. No SharePoint request was made by that failed attempt.

The second execution used saved Playwright authentication state and SharePoint REST against the app-test site only.

Prechecks:

- `SupportCases`: HTTP 404 before creation.
- `SupportCaseDocuments`: HTTP 404 before creation; no create attempted.
- `SupportCaseEvents`: HTTP 404 before creation; no create attempted.
- `SupportCaseRestrictedDocuments`: HTTP 404 before creation; no create attempted.

Creation:

- Created list: `SupportCases`
- Created list ID: `c165b5fc-716d-4a61-a2e2-64f003b6566c`
- Created list URL: `/sites/app-test/Lists/SupportCases`
- Created list `BaseTemplate`: `100`

## Created Fields

The operation attempted the planned `SUPPORT_CASES_PROVISIONING_FIELDS` only.

Field creation calls completed for 13 planned fields:

- `CaseId`
- `TenantId`
- `UserId`
- `ServiceType`
- `Status`
- `OpenedOn`
- `ClosedOn`
- `PrimaryStaffId`
- `CreatedAt`
- `CreatedByKey`
- `UpdatedAt`
- `UpdatedByKey`
- `IsDeleted`

Readback showed SharePoint physical internal names resolved mostly to encoded display-name variants:

| Planned internal name | Readback internal name | Title | Type | Required |
|---|---|---|---|---|
| `CaseId` | `Case_x0020_ID` | `Case ID` | `Text` | true |
| `TenantId` | `Tenant_x0020_ID` | `Tenant ID` | `Text` | true |
| `UserId` | `User_x0020_ID` | `User ID` | `Text` | true |
| `ServiceType` | `Service_x0020_Type` | `Service Type` | `Text` | true |
| `Status` | `Status` | `Status` | `Text` | true |
| `OpenedOn` | `Opened_x0020_On` | `Opened On` | `DateTime` | true |
| `ClosedOn` | `Closed_x0020_On` | `Closed On` | `DateTime` | false |
| `PrimaryStaffId` | `Primary_x0020_Staff_x0020_ID` | `Primary Staff ID` | `Text` | true |
| `CreatedAt` | `Created_x0020_At` | `Created At` | `DateTime` | true |
| `CreatedByKey` | `Created_x0020_By_x0020_Key` | `Created By Key` | `Text` | true |
| `UpdatedAt` | `Updated_x0020_At` | `Updated At` | `DateTime` | true |
| `UpdatedByKey` | `Updated_x0020_By_x0020_Key` | `Updated By Key` | `Text` | true |
| `IsDeleted` | `Is_x0020_Deleted` | `Is Deleted` | `Boolean` | false |

These readback names are included in the existing SupportCase field candidate arrays, but they do not exactly match the canonical planned internal names for most fields. Do not proceed to additional app-test resource creation until this naming behavior is reviewed.

## Read-Only Verification

Read-only verification after creation:

- `SupportCases` metadata read: HTTP 200.
- `SupportCases` fields read: HTTP 200.
- `SupportCaseDocuments` metadata read: HTTP 404; no create attempted.
- `SupportCaseEvents` metadata read: HTTP 404; no create attempted.
- `SupportCaseRestrictedDocuments` metadata read: HTTP 404; no create attempted.

## Boundaries Confirmed

- Production touched: no.
- Permission changed: no.
- `SupportCaseDocuments` created: no.
- `SupportCaseEvents` created: no.
- `SupportCaseRestrictedDocuments` created: no.
- Document library created: no.
- Restricted library created: no.
- UI connected: no.
- Migration run: no.
- Graph API or `spFetch` implementation changed: no.
- `SupportCaseRepository` changed: no.

## Stop Conditions Before Next Creation

Stop before creating additional SupportCase resources until all of the following are reviewed:

- Whether SharePoint physical internal names using encoded display-name variants are acceptable for app-test.
- Whether diagnostics and repository field resolution should rely on existing candidate arrays for these fields.
- Whether future creation steps need a different field creation option to preserve canonical internal names.
- Whether `SupportCaseEvents`, `SupportCaseDocuments`, and `SupportCaseRestrictedDocuments` should proceed separately.
- Whether `SupportCaseRestrictedDocuments` permission and document-library boundary are approved.

## Recommended Next Action

Do not create `SupportCaseEvents`, `SupportCaseDocuments`, or `SupportCaseRestrictedDocuments` yet.

Recommended next step:

- Review the `SupportCases` field internal-name readback.
- Then decide whether to record a naming-alignment decision before any further app-test resource creation.
