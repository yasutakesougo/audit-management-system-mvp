# SupportCase Field Resolution Decision - 2026-06-10

## Scope

This report records the field-resolution decision for the app-test `SupportCases` list after its internal-name readback was documented.

This is a docs-only decision record. It does not connect to SharePoint, rerun diagnostics, create additional resources, change permissions, update runtime code, or connect UI or repository behavior.

## Decision

Adopt candidate-based field resolution for the app-test `SupportCases` list.

The observed SharePoint physical internal names are accepted because each observed internal name is already covered by the existing `SUPPORT_CASES_CANDIDATES` arrays.

Do not require the physical SharePoint internal name to exactly match the canonical planned name for the existing app-test `SupportCases` list.

## Rationale

The app-test `SupportCases` list was created from the planned field definitions, but SharePoint resolved most physical internal names from display names:

- Planned: `CaseId`; observed: `Case_x0020_ID`
- Planned: `TenantId`; observed: `Tenant_x0020_ID`
- Planned: `UserId`; observed: `User_x0020_ID`
- Planned: `ServiceType`; observed: `Service_x0020_Type`
- Planned: `OpenedOn`; observed: `Opened_x0020_On`
- Planned: `ClosedOn`; observed: `Closed_x0020_On`
- Planned: `PrimaryStaffId`; observed: `Primary_x0020_Staff_x0020_ID`
- Planned: `CreatedAt`; observed: `Created_x0020_At`
- Planned: `CreatedByKey`; observed: `Created_x0020_By_x0020_Key`
- Planned: `UpdatedAt`; observed: `Updated_x0020_At`
- Planned: `UpdatedByKey`; observed: `Updated_x0020_By_x0020_Key`
- Planned: `IsDeleted`; observed: `Is_x0020_Deleted`

`Status` matched exactly.

The current field candidate definitions already include these observed names. Treating the encoded names as valid candidates avoids incorrectly marking the app-test list as missing essential fields while still preserving the canonical planned names in definitions.

## Candidate Coverage

| Domain key | Canonical planned name | Accepted observed name | Candidate coverage |
|---|---|---|---|
| `caseId` | `CaseId` | `Case_x0020_ID` | yes |
| `tenantId` | `TenantId` | `Tenant_x0020_ID` | yes |
| `userId` | `UserId` | `User_x0020_ID` | yes |
| `serviceType` | `ServiceType` | `Service_x0020_Type` | yes |
| `status` | `Status` | `Status` | yes |
| `openedOn` | `OpenedOn` | `Opened_x0020_On` | yes |
| `closedOn` | `ClosedOn` | `Closed_x0020_On` | yes |
| `primaryStaffId` | `PrimaryStaffId` | `Primary_x0020_Staff_x0020_ID` | yes |
| `createdAt` | `CreatedAt` | `Created_x0020_At` | yes |
| `createdByKey` | `CreatedByKey` | `Created_x0020_By_x0020_Key` | yes |
| `updatedAt` | `UpdatedAt` | `Updated_x0020_At` | yes |
| `updatedByKey` | `UpdatedByKey` | `Updated_x0020_By_x0020_Key` | yes |
| `isDeleted` | `IsDeleted` | `Is_x0020_Deleted` | yes |

The essential field check for `SupportCases` should therefore accept:

- `CaseId` or `Case_x0020_ID`
- `TenantId` or `Tenant_x0020_ID`
- `UserId` or `User_x0020_ID`
- `Status`

## Field Creation and Readback Policy

For the existing app-test `SupportCases` list:

- Read and diagnostics behavior should resolve fields through the candidate arrays.
- Exact physical internal-name equality with the canonical planned name is not required when a covered candidate exists.
- A covered encoded internal name should be recorded as an accepted app-test mapping, not as drift by itself.

For future app-test resource creation:

- Create only one SupportCase resource per approved operation.
- After field creation, read back the actual SharePoint internal names.
- Compare actual names against each field's candidate array, not only against the canonical planned name.
- Treat a candidate-covered encoded name as acceptable only when explicitly recorded in the candidate array.
- Treat any unknown internal name, missing required field, or type mismatch as a stop condition.

## Exact-Name Mismatch Stop Conditions

Stop before creating additional resources or running broader diagnostics if any of the following occurs:

- A required field is missing from the readback result.
- A readback field is present but is not covered by the relevant candidate array.
- A field type differs from the planned type.
- A list is created as a document library, or a document library is created as a list.
- A future script would create more than one SupportCase resource in a single operation.
- A future script needs permission changes to pass readback.
- A future script would target production or an unknown site.

## Application to Future Resources

Apply the same candidate-based readback policy to the next SupportCase resources, but only after separate approval for each creation step:

- `SupportCaseEvents`
- `SupportCaseDocuments`
- `SupportCaseRestrictedDocuments`

The policy does not authorize creation of those resources. It only defines how their field readback should be evaluated if a later approved operation creates them.

`SupportCaseRestrictedDocuments` remains a separate document-library and permission-boundary decision. Candidate-based field resolution does not approve restricted-library creation or permission changes.

## Out of Scope

- No SharePoint connection.
- No diagnostics rerun.
- No `SupportCaseDocuments` creation.
- No `SupportCaseEvents` creation.
- No `SupportCaseRestrictedDocuments` creation.
- No document library creation.
- No restricted library creation.
- No permission changes.
- No production changes.
- No UI integration.
- No migration.
- No Graph API or `spFetch` changes.
- No `SupportCaseRepository` changes.

## Next Step

Keep additional app-test resource creation stopped until there is explicit approval for the next single resource.

If the next approved resource is created, the operation should include a readback report that records actual internal names and candidate coverage before proceeding further.
