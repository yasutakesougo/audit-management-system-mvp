## Summary
This PR fixes a diagnostics-layer schema mismatch that could trigger HTTP 400 on `DriftEventsLog_v2`, and prevents that failure from surfacing on `/today` as a generic sync-delay banner.

## Root cause
`SharePointDriftEventRepository` writes `DriftType`, but the `drift_events_log` provisioning definition did not include that column. In unresolved cases, fallback behavior could still attempt to write the first candidate field, producing HTTP 400.

## Changes
- add `DriftType` to `drift_events_log` provisioning fields
- harden drift-event write fallback so unresolved optional fields are omitted instead of blindly written
- refine connection-status classification so diagnostics-list issues do not appear as broad sync-delay on `/today`
- add regression tests for repository write behavior and connection-status classification

## Validation
- `SharePointDriftEventRepository.spec.ts` passes
- `useConnectionStatus.spec.ts` passes
- Verified on local environment that `/today?kiosk=1` no longer shows "Sync Delay" for purely diagnostic issues.

## Notes
- This PR is intentionally minimal. It does not change business-list schemas such as `SupportRecord_Daily` or `Attendance` unless separately verified.
- **IMPORTANT**: existing SharePoint environments still require provisioning of the `DriftType` column on `DriftEventsLog_v2` to fully eliminate legacy 400s.
