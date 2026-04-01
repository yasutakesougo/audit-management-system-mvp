# ADR-013: SharePoint Column Explosion Mitigation & Quality Gate Restoration

## Status
Proposed (Implemented in Phase 1-2)

## Context
In the production tenant, the `Users_Master` and `SupportProcedureRecord_Daily` lists hit the SharePoint 8KB row size limit due to repeated field provisioning ("Column Explosion"). This caused:
- **API 500 Responses** from SharePoint when fetching items.
- **Diagnostic Failures**: The health dashboard was unable to fetch status markers.
- **Operational Deadlock**: Data could not be saved or fetched by the application logic.

## Decision
1. **Dynamic Schema Resolution (`Fuzzy Schema`)**:
   - The application must not assume fixed internal names.
   - At runtime, the `SchemaResolver` fetches available field internal names and maps them to domain keys, using the canonical name if the "duplicate-suffixed" name (e.g., `cr013_UserID0`) is present.
   
2. **"Virtual Fix" (Application-side Sanitization)**:
   - When fetching normalized data (from `Users_Master`), if legacy/duplicated fields contain outdated data, the application must explicitly clear/sanitize them before merging accessory data.
   - The sanitization must occur **before** joining data from accessory lists (Split List architecture).

3. **Robust Quality Gates**:
   - **Type Safety**: New `schema_warning` status added to all observability interfaces (`ResourceStatus`) to detect schema drift early.
   - **OData Range Filtering**: Transitioned from `eq` to `ge/le` for date filters to avoid precision issues with SharePoint DateTime/Date fields.
   - **Contract-Based Factory Usage**: Strict enforcement of `useXXXRepository` hooks to prevent direct `RepositoryFactory` usage that bypasses schema resolution.

## Consequences
- **Positive**: The system is now resilient to redundant/duplicate columns in SharePoint.
- **Positive**: The application remains operational and "Safe to Develop" even if the physical infrastructure is partially corrupted.
- **Requirement**: Future provisioning logic ("Provisioning AI") must implement a "Collision Guard" that checks for existing name-matches or suffixes BEFORE creating new columns.
- **Requirement**: CI/CD must run `typecheck:full` and `lint` as mandatory gates to prevent quality regressions during infrastructure recovery.
