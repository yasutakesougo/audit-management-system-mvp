## Summary
Apply UI improvements to the Health Diagnosis page and the Individual Support Plan (ISP) / Monitoring bridge. This PR isolates the frontend and UX changes from the underlying SharePoint infrastructure hardening.

## Why
The previous scope of PR #1373 grew too large, mixing UI improvements with SharePoint repository SSOT drift resolution. To ensure safe review and continuous deployment, this PR focuses strictly on the user-facing Health Diagnosis UI and the Support Planning Sheet bridge interactions.

## Scope
- Domain: Diagnostics UI / Support Planning Sheet
- Layers: UI components (`HealthDiagnosisPage`), hooks (`useImportHandlers`, `useSupportPlanningSheetUiState`), and frontend tests.
- Out of scope: SharePoint list schema drift resolution, observability infrastructure, nightly patrol scripts (these are split into separate PRs).

## Changes
### 1. Health Diagnosis UI
- Updated `HealthDiagnosisPage.tsx` to provide clearer diagnostic status categories.
- Added visual breakdown of diagnostic results per domain module.
- Improved layout spacing, copy-to-clipboard actions, and status chips for better readability.

### 2. Monitoring-Planning Bridge
- Updated `useImportHandlers.ts` and UI states to safely map imported Support Planning Sheet records to the proper UI state.
- Enhanced `BridgeSuggestionsSection.tsx` with action buttons to reflect records directly into the UI state.
- Standardized `ToastState` usage for bridge import actions.
- Added `useImportHandlers.spec.ts` for unit testing the state transitions on record import.

## Verification
- `npm run -s typecheck` -> passed
- `npx vitest run tests/unit/useImportHandlers.spec.ts` -> passed
- `npm run lint` -> passed (--max-warnings=0)

## Review Focus
- Ensure the state updates in `useImportHandlers` handle all edge cases correctly.
- Review the `HealthDiagnosisPage.tsx` layout and styling updates.

## PR Title
`feat(diagnostics): improve health diagnosis UI and monitoring-planning bridge`
