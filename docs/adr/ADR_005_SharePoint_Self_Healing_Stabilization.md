# ADR 005: SharePoint Self-Healing Infrastructure Stabilization

## Status
Accepted

## Context
SharePoint-backed applications frequently suffer from "Schema Drift," where the physical list schema (columns) in the production tenant does not match the application's domain requirements. This typically leads to `400 Bad Request` or `500 Internal Server Error` during write operations, specifically failing with "Property does not exist" errors.

In the Service Provision feature, we encountered a scenario where the `ServiceProvisionRecords` list existed but lacked critical columns (`EntryKey`, `UserCode`), causing production outages despite the list being "detected" by basic diagnostics.

## Decision
We will implement and enforce a "Self-Healing Infrastructure" pattern across all critical business domains.

### 1. Hardened Registry (SSOT)
All SharePoint lists MUST be defined in `spListRegistry.ts` with:
- `lifecycle: 'required'`: This ensures the `SharePointDataProvider` triggers a schema check before the first data access.
- `essentialFields`: A list of internal names that MUST exist for the feature to be considered healthy.
- `provisioningFields`: A complete set of field definitions (Name, Type, DisplayName) used to automatically heal the schema.

### 2. Automated Triggering
We will use the `SharePointDataProvider.ensureResource` hook to lazily but reliably verify the schema of `required` lists. If a mismatch is detected, the system will attempt to `provision` the missing fields before permitting CRUD operations.

### 3. Fail-Safe Provisioning
The provisioning logic (via `spProvisioningService`) must handle SharePoint's "Row Size Limit" (8KB) and "Index Limit" (20 indexes) by logging warnings but allowing partial success if possible, while ensuring critical keys (`EntryKey`, `Date`, etc.) are always present.

## Consequences

### Positive
- **Production Resilience**: The application can recover from accidental deletions or incomplete migrations in the production tenant.
- **Onboarding Reliability**: New environments (dev/test/staging) are automatically provisioned upon first use.
- **Audit Readiness**: Diagnostics can accurately report not just "List exists" but "Schema is compliant."

### Negative
- **Startup Overhead**: The first data access for each list incurs a round-trip to SharePoint to verify the schema. This is mitigated by `sessionStorage` caching of the "Stable" status.
- **API Complexity**: Developers must maintain a duplicated definition of fields in both the Domain model and the Registry.

## Implementation Details
- `src/sharepoint/spListRegistry.ts`: Central source of truth.
- `src/lib/sp/spDataProvider.ts`: Orchestrates the `ensureResource` call.
- `src/sharepoint/spProvisioningCoordinator.ts`: Provides UI/Admin capability to force-trigger healing.
