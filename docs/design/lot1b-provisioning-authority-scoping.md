# Lot 1b Scoping Memo — provisioning authority for runtime-managed lists

## Summary
`UserTransport_Settings` and `SupportProcedureRecord_Daily` are not governed by `provision/schema.xml`.
Their canonical provisioning authority is `src/sharepoint/spListRegistry.ts`, where both lists are declared as `lifecycle=required`.

The three Lot 1b target fields are already present in `provisioningFields`:
- `UserTransport_Settings.TransportAdditionType`
- `SupportProcedureRecord_Daily.ISPId`
- `SupportProcedureRecord_Daily.HandoffNotes`

Therefore, Lot 1b is not a “missing field definition” change.
It is an authority-governance change: clarify that these lists belong to the runtime registry authority, not the XML authority.

## Evidence
### UserTransport_Settings
- canonical definition: `src/sharepoint/spListRegistry.ts`
- lifecycle: `required`
- target field already declared: `TransportAdditionType`
- `provision/schema.xml`: not included
- runtime list exists in production; drift shows `optional-missing`

### SupportProcedureRecord_Daily
- canonical definition: `src/sharepoint/spListRegistry.ts`
- lifecycle: `required`
- target fields already declared: `ISPId`, `HandoffNotes`
- `provision/schema.xml`: not included
- audit manifest may include the list, but that is not the provisioning authority
- runtime list exists in production; drift shows `optional-missing`

## Case classification
Provisional case: **Case C**

Reason:
A canonical XML authority exists for some lists, but runtime registry–based provisioning also acts as canonical authority for runtime-managed lists. In parallel, multiple per-list / REST / Graph / Node provisioning paths exist as historical or operational side paths.

## Decision
Adopt **Option 3**:
- `schema.xml` remains the declarative authority for bootstrap-oriented lists
- `spListRegistry.ts` remains the canonical authority for runtime-managed / lifecycle-required lists
- Lot 1b target lists belong to the runtime-managed authority

## Non-goals
- Do not move these two lists into `schema.xml` in Lot 1b
- Do not remove historical provisioning scripts yet
- Do not implement a repo-wide provisioning unification in this lot

## Required follow-up
1. Document the dual-authority boundary in ADR/design docs
2. Define whether `optional-missing` on runtime-managed lists should:
   - self-heal automatically,
   - require an explicit trigger,
   - or be surfaced as action-required when heal does not occur
3. Classify existing non-canonical scripts into:
   - canonical runtime support
   - repair-only
   - deprecation candidates

## Proposed implementation shape for Lot 1b
Lot 1b should be split into:
- **Lot 1b-doc**: authority boundary clarification
- **Lot 1b-heal**: trigger/verify runtime provisioning for the 3 already-declared fields
- **Lot 1b-cleanup**: future script classification / retirement
