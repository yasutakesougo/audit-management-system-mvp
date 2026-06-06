# System Structure Baseline

Date: 2026-06-06

## Scope

- Refresh the generated system map.
- Remove the duplicate browser router.
- Verify navigation-to-route integration.
- Capture the current quality baseline.

## Structural Changes

- `src/app/router.tsx` is the single browser router definition.
- The unused duplicate `src/app/appRouter.tsx` was removed.
- `tests/unit/navigation-router.spec.ts` now verifies the production router.
- `scripts/generate-system-map.ts` scans domain route modules under:
  - `src/app/routes`
  - `src/features/nurse/routes`
- `system-map.md` was regenerated from the current source tree.
- Static and dynamic imports were aligned for the SharePoint health store and audit batch hook.
- Staff and users route prefetching now imports their page components directly instead of eagerly loading feature barrels.
- Meeting-minute prefix constants were separated from BlockNote editor code so pure mapping and export code does not load the editor runtime.
- BlockNote follows the meeting-minutes lazy boundary instead of a forced manual chunk.
- Monitoring-meeting PDF generation now loads the renderer, document component, and font registry only when export is requested.

## Quality Baseline

| Check | Result |
| --- | --- |
| `npm run gen:system-map` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed with existing bundle warnings |
| `npm run build:ci` | Passed with required per-asset bundle budgets |
| `npm run test:ci:required` | Passed: 51 files, 460 tests |
| Router integration test | Passed: 1 file, 1 test |
| Targeted import-boundary tests | Passed: 4 files, 14 tests |
| Meeting-minutes dependency tests | Passed: 4 files, 98 tests |
| Locales shim verification test | Passed: 1 file, 1 test (integrated in build:ci) |

## Bundle Boundary Result

- The React/BlockNote circular chunk warning was removed.
- Four static/dynamic import conflict warnings were removed.
- The modern `App` chunk decreased from about 1.05 MB during the intermediate build to about 553 kB.
- BlockNote is isolated to the lazy `MeetingMinutesBlockEditor` chunk at about 1.02 MB.
- `TimeBasedSupportRecordPage` decreased from about 1.01 MB to about 67 kB.
- Support procedure Excel generation is loaded only when export is requested and is isolated to an approximately 939 kB chunk.
- `MonitoringMeetingRecordPage` is about 24.5 kB and has no static import of the PDF vendor chunk.
- Monitoring-meeting PDF generation is isolated behind the export click into the approximately 1.58 MB PDF vendor chunk.
- Required modern and legacy budgets now guard the application shell, PDF renderer, BlockNote editor, and Excel export chunks.
- BlockNote locales were optimized using a lightweight shim to prevent future dependency updates from bundling unused multi-language payload. PDF and Excel remain unchanged as verified best-practices.

## Known Follow-up Items

- The system map statically extracts literal route paths. Runtime-generated hub routes and full parent paths for nested route objects are not expanded.
- The modern and legacy bundles contain chunks larger than the configured 900 kB warning threshold, notably PDF, BlockNote, and Excel generation bundles.
- Intentional error-path tests still emit application error logs, but the identified nested Vitest mock compatibility warnings were removed.
- System map generation logs non-fatal environment validation warnings when SharePoint and MSAL variables are absent.
