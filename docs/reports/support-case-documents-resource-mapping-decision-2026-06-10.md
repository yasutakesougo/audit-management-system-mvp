# SupportCaseDocuments Resource Mapping Decision - 2026-06-10

## Scope

This report records the resource mapping and field-resolution decision for `SupportCaseDocuments` before any app-test creation.

This is a docs-only planning record. It does not connect to SharePoint, rerun diagnostics, create lists or libraries, change permissions, update runtime code, connect UI, migrate documents, or change `SupportCaseRepository` behavior.

## Target Resource

| Property | Decision |
|---|---|
| Resource | `SupportCaseDocuments` |
| Registry key | `support_case_documents` |
| Diagnostics target key | `support_case_documents` |
| Default title | `SupportCaseDocuments` |
| Expected internal URL/name | `SupportCaseDocuments` |
| Environment override | `VITE_SP_LIST_SUPPORT_CASE_DOCUMENTS` |
| Lifecycle | `experimental` |
| SharePoint type | List |
| Purpose | Standard and restricted document reference metadata |

`SupportCaseDocuments` is the metadata index for document references. It is not the file storage location and is not the restricted personal-information document library.

## List vs Document Library Decision

Treat `SupportCaseDocuments` as a SharePoint List.

Rationale:

- Existing registry planning defines `support_case_documents` as `SupportCaseDocuments` with type `List`.
- The generic SupportCase data model describes this resource as normal and restricted document reference metadata.
- File upload and existing document migration are out of scope.
- Restricted personal-information file storage remains separated in `SupportCaseRestrictedDocuments`, which is the document-library candidate.

Therefore:

- `SupportCaseDocuments` stores metadata and references only.
- It must not become a document library.
- It must not store restricted files directly.
- It may contain metadata that points to normal or restricted storage targets, but the boundary must be represented by fields such as `StoragePolicy`, `LibraryTarget`, `Sensitivity`, and `AuditLogRequired`.

## Field Candidate Mapping

The following fields are the primary mapping boundary for app-test creation planning. Candidate names come from the existing `SUPPORT_CASE_DOCUMENTS_CANDIDATES` definitions.

| Field purpose | Planned internal name | Display name | Candidate internal names |
|---|---|---|---|
| Document identity | `DocumentId` | `Document ID` | `DocumentId`, `Document_x0020_ID`, `documentId`, `cr013_documentId` |
| Tenant identity | `TenantId` | `Tenant ID` | `TenantId`, `Tenant_x0020_ID`, `tenantId`, `cr013_tenantId` |
| Case identity | `SupportCaseId` | `Support Case ID` | `SupportCaseId`, `Support_x0020_Case_x0020_ID`, `CaseId`, `caseId` |
| Case record identity | `CaseRecordId` | `Case Record ID` | `CaseRecordId`, `Case_x0020_Record_x0020_ID`, `caseRecordId` |
| Document category | `Category` | `Document Category` | `Category`, `DocumentCategory`, `Document_x0020_Category` |
| File name reference | `FileName` | `File Name` | `FileName`, `File_x0020_Name`, `FileLeafRef` |
| Storage policy | `StoragePolicy` | `Storage Policy` | `StoragePolicy`, `Storage_x0020_Policy`, `storagePolicy` |
| Library target | `LibraryTarget` | `Library Target` | `LibraryTarget`, `Library_x0020_Target`, `libraryTarget` |
| Storage locator | `StorageLocator` | `Storage Locator` | `StorageLocator`, `Storage_x0020_Locator`, `storageLocator` |
| Sensitivity | `Sensitivity` | `Sensitivity` | `Sensitivity`, `DocumentSensitivity`, `sensitivity` |
| Audit boundary | `AuditLogRequired` | `Audit Log Required` | `AuditLogRequired`, `Audit_x0020_Log_x0020_Required`, `auditLogRequired` |
| Template key | `TemplateKey` | `Template Key` | `TemplateKey`, `Template_x0020_Key`, `templateKey` |
| Template version | `TemplateVersion` | `Template Version` | `TemplateVersion`, `Template_x0020_Version`, `templateVersion` |
| Created timestamp | `CreatedAt` | `Created At` | `CreatedAt`, `Created_x0020_At`, `createdAt` |
| Creator key | `CreatedByKey` | `Created By Key` | `CreatedByKey`, `Created_x0020_By_x0020_Key`, `createdBy` |
| Source | `Source` | `Source` | `Source`, `DocumentSource`, `source` |
| Deleted marker | `IsDeleted` | `Is Deleted` | `IsDeleted`, `Is_x0020_Deleted`, `isDeleted` |

## Essential Fields

The essential field set remains:

- `DocumentId`
- `TenantId`
- `SupportCaseId`
- `Category`
- `StoragePolicy`
- `LibraryTarget`
- `Sensitivity`
- `AuditLogRequired`

Do not proceed if any essential field is missing or cannot be resolved through the candidate set after readback.

## Boundary Fields

The following fields are boundary-critical:

- `StoragePolicy`: separates normal document references from restricted-document storage policy.
- `AuditLogRequired`: marks document references that require audit logging, especially across restricted-document boundaries.
- `LibraryTarget`: prevents mixing normal document references with restricted library references.
- `Sensitivity`: carries the sensitivity classification for downstream decisions.

These fields must exist before any repository, UI, migration, or upload behavior is connected.

## Candidate-Based Resolution Decision

Adopt candidate-based field resolution for `SupportCaseDocuments`.

This follows the `SupportCases` field-resolution decision:

- Do not assume exact physical internal-name equality with the canonical planned name.
- Accept encoded internal names, legacy aliases, and camelCase aliases only when they are explicitly listed in the candidate array.
- Readback after future creation must compare actual SharePoint internal names against candidates.
- A field that is present but not covered by the candidate set is a stop condition.
- A candidate-covered encoded name is acceptable only after being recorded in the creation result.

This decision does not authorize creation of `SupportCaseDocuments`; it only defines how field readback should be evaluated if a later approved operation creates it.

## Pre-Creation and Post-Creation Readback Checks

Before any future creation operation:

- Confirm target site is app-test.
- Confirm production is excluded.
- Confirm `SupportCaseDocuments` is not already present, or classify any existing resource before proceeding.
- Confirm the target resource type is List.
- Confirm creation is limited to `SupportCaseDocuments`.
- Confirm no permission change is part of the operation.

After any later approved creation operation:

- Read list metadata.
- Confirm title is `SupportCaseDocuments`.
- Confirm internal URL/name is the approved value or recorded mapping.
- Confirm the resource is a List, not a document library.
- Read actual field internal names.
- Resolve actual field names through `SUPPORT_CASE_DOCUMENTS_CANDIDATES`.
- Confirm `StoragePolicy`, `AuditLogRequired`, `LibraryTarget`, and `Sensitivity` are present.
- Confirm `SupportCaseEvents` and `SupportCaseRestrictedDocuments` were not created by the same operation.

## Exact-Name Mismatch Stop Conditions

Stop before additional creation, diagnostics expansion, repository wiring, or UI work if any of the following occurs:

- A planned field name differs from the actual SharePoint name and the actual name is not covered by the candidate array.
- A required field cannot be resolved.
- A field type differs from the planned type.
- `SupportCaseDocuments` exists as a document library instead of a List.
- Restricted-document boundary fields are missing.
- Restricted-document metadata and normal document metadata become indistinguishable.
- `StoragePolicy`, `AuditLogRequired`, or `LibraryTarget` semantics are unclear.
- A future operation would create multiple SupportCase resources at once.
- A future operation requires permission changes to pass readback.
- The target site is production or ambiguous.

## Application to Later Resources

Apply the same candidate-based field-resolution and readback policy to later resources only after separate approval:

- `SupportCaseEvents`
- `SupportCaseRestrictedDocuments`

The policy does not authorize creation of those resources.

`SupportCaseRestrictedDocuments` remains a separate document-library and permission-boundary decision. The metadata-list decision for `SupportCaseDocuments` must not be reused as approval for restricted library creation.

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
- No `.env`, token, or secret changes.

## Next Step

Keep `SupportCaseDocuments` creation stopped until explicit approval is given for the next single app-test resource.

Required approval wording:

```txt
app-test に SupportCaseDocuments list を作成してよい
```
