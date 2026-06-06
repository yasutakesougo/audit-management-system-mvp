# Improvement Roadmap

Date: 2026-06-06

## Current Status

### Phase 0: Structure and baseline

Status: Completed

- Consolidated the browser router.
- Regenerated the system map.
- Removed static/dynamic import conflicts and the BlockNote circular chunk warning.
- Moved Excel and monitoring-meeting PDF generation behind export-time lazy boundaries.

### Phase 1: Test warning cleanup

Status: Completed for the identified Vitest compatibility warnings

- Moved nested `vi.mock` calls to module scope.
- Replaced cleanup-time `vi.unmock` calls with non-hoisted `vi.doUnmock`.
- Added explicit SharePoint test environment values where the real environment module is loaded.
- Verified that the identified "not at the top level" warnings no longer appear.

### Phase 2: Bundle budget automation

Status: Completed

`npm run build:ci` now verifies the following required modern and legacy assets:

| Asset | Current | Budget |
| --- | ---: | ---: |
| Application shell | 539.9 kB | 600 kB |
| Legacy application shell | 525.3 kB | 600 kB |
| PDF renderer | 1540.2 kB | 1650 kB |
| Legacy PDF renderer | 1517.5 kB | 1650 kB |
| BlockNote editor | 992.7 kB | 1100 kB |
| Legacy BlockNote editor | 1195.7 kB | 1250 kB |
| Excel export | 917.2 kB | 1000 kB |
| Legacy Excel export | 912.8 kB | 1000 kB |

The guard fails if a required target disappears, is renamed outside its expected boundary, or exceeds its budget.

## Next Actions

### Phase 3: Large chunk reduction — Completed

BlockNote editor chunk was reduced by replacing unused BlockNote locale payloads with a lightweight shim through Vite aliasing. The application intentionally keeps Japanese and English locale data, while other locales fall back to English.

PDF renderer and Excel export were evaluated but intentionally left unchanged.

- PDF: `@react-pdf/renderer` remains necessary for audit-facing, one-click, layout-stable PDF generation.
- Excel: `exceljs` remains necessary to preserve existing template styles, borders, print layout, and official form appearance.
- Both PDF and Excel modules remain lazy-loaded and separated from the main application path.

This is recorded as a no-change decision rather than unfinished optimization.

### Phase 4: System map accuracy

Priority: Medium

1. Resolve full paths for nested route objects.
2. Include routes generated from runtime configuration.
3. Detect duplicate paths, orphan pages, and navigation targets without routes.
4. Add snapshot tests for generated route inventory.

### Phase 5: Continuous quality

Priority: Medium

- **Task 1: Extend bundle budgets to other stable vendor and page chunks**: Completed on 2026-06-06 (Issue #2116). Expanded coverage to React Core, MUI Framework, Firebase SDK, and three key page components with strict required budget targets.
- **Task 2: Reduce intentional test console noise**: Open (Issue #2117).
- **Task 3: Review budgets when dependencies or browser support targets change**: Continuous.

## Verification

- `npm run typecheck`: Passed
- `npm run lint`: Passed
- `npm run test:ci:required`: Passed, 51 files and 460 tests
- `npm run build:ci`: Passed

