# SupportCase App-Test SupportCases Internal Name Mapping - 2026-06-10

## Scope

This report records the internal-name mapping observed after creating the `SupportCases` list in the app-test SharePoint site.

This is a docs-only follow-up to the `SupportCases` creation result. It does not perform SharePoint diagnostics, create additional lists or libraries, change permissions, update application code, or connect the UI or repository.

## Source

Observed values come from:

- `docs/reports/support-case-app-test-supportcases-list-creation-result-2026-06-10.md`
- `src/sharepoint/fields/supportCaseFields.ts`

Target context:

| Property | Value |
|---|---|
| Site | `https://isogokatudouhome.sharepoint.com/sites/app-test` |
| Resource key | `support_cases` |
| List title | `SupportCases` |
| List URL | `/sites/app-test/Lists/SupportCases` |
| List ID | `c165b5fc-716d-4a61-a2e2-64f003b6566c` |
| BaseTemplate | `100` |

## Mapping

The `SUPPORT_CASES_PROVISIONING_FIELDS` definitions used canonical planned internal names such as `CaseId` and display names such as `Case ID`.

The SharePoint readback resolved most physical internal names to encoded display-name variants. These encoded names are already present in the `SUPPORT_CASES_CANDIDATES` arrays, so diagnostics and mappers should resolve by the candidate set rather than assuming the canonical name is the only physical internal name.

| Domain / mapper key | Planned internal name | Display name | Actual SharePoint internal name | Candidate coverage | Notes |
|---|---|---|---|---|---|
| `caseId` | `CaseId` | `Case ID` | `Case_x0020_ID` | yes | Essential field. Use the candidate set for resolution. |
| `tenantId` | `TenantId` | `Tenant ID` | `Tenant_x0020_ID` | yes | Essential field. Use the candidate set for resolution. |
| `userId` | `UserId` | `User ID` | `User_x0020_ID` | yes | Essential field. Use the candidate set for resolution. |
| `serviceType` | `ServiceType` | `Service Type` | `Service_x0020_Type` | yes | Encoded physical name differs from the planned name. |
| `status` | `Status` | `Status` | `Status` | yes | Planned and actual names match. |
| `openedOn` | `OpenedOn` | `Opened On` | `Opened_x0020_On` | yes | Encoded physical name differs from the planned name. |
| `closedOn` | `ClosedOn` | `Closed On` | `Closed_x0020_On` | yes | Optional field. Encoded physical name differs from the planned name. |
| `primaryStaffId` | `PrimaryStaffId` | `Primary Staff ID` | `Primary_x0020_Staff_x0020_ID` | yes | Encoded physical name differs from the planned name. |
| `createdAt` | `CreatedAt` | `Created At` | `Created_x0020_At` | yes | Encoded physical name differs from the planned name. |
| `createdByKey` | `CreatedByKey` | `Created By Key` | `Created_x0020_By_x0020_Key` | yes | Encoded physical name differs from the planned name. |
| `updatedAt` | `UpdatedAt` | `Updated At` | `Updated_x0020_At` | yes | Encoded physical name differs from the planned name. |
| `updatedByKey` | `UpdatedByKey` | `Updated By Key` | `Updated_x0020_By_x0020_Key` | yes | Encoded physical name differs from the planned name. |
| `isDeleted` | `IsDeleted` | `Is Deleted` | `Is_x0020_Deleted` | yes | Encoded physical name differs from the planned name. |

## Essential Field Resolution

The `SUPPORT_CASES_ESSENTIAL_FIELDS` list remains:

- `CaseId`
- `TenantId`
- `UserId`
- `Status`

For the app-test `SupportCases` list, essential-field checks should treat the following actual SharePoint internal names as valid candidates:

- `Case_x0020_ID`
- `Tenant_x0020_ID`
- `User_x0020_ID`
- `Status`

The essential fields are present by candidate resolution. They should not be treated as missing solely because the physical SharePoint internal name differs from the canonical planned name.

## Operational Interpretation

- The app-test list exists and is readable.
- The list is a SharePoint list, not a document library.
- The observed encoded internal names are compatible with the current candidate arrays.
- Runtime and diagnostics code should continue resolving fields through candidate arrays.
- Do not hard-code only the canonical planned names when reading the app-test `SupportCases` list.

## Stop Conditions Before Additional Resource Creation

Do not create `SupportCaseDocuments`, `SupportCaseEvents`, or `SupportCaseRestrictedDocuments` until these items are reviewed:

- Whether candidate-based resolution is acceptable for the app-test `SupportCases` list.
- Whether future creation steps should preserve canonical physical internal names or accept encoded display-name variants.
- Whether the next creation scripts should verify both canonical and encoded candidate names after field creation.
- Whether a failed exact-name check should stop future creation before any SharePoint mutation occurs.
- Whether the restricted document library creation plan remains separated from normal list creation.

## Out of Scope

- No `SupportCaseDocuments` creation.
- No `SupportCaseEvents` creation.
- No `SupportCaseRestrictedDocuments` creation.
- No document library creation.
- No restricted library creation.
- No permission changes.
- No production changes.
- No diagnostics rerun.
- No UI integration.
- No migration.
- No Graph API or `spFetch` changes.
- No `SupportCaseRepository` changes.

## Recommended Next Action

Review and approve the candidate-based field resolution interpretation before any additional app-test SupportCase resource creation.

If approved, the next app-test creation step should still be a separate, explicitly approved operation for one resource at a time.
