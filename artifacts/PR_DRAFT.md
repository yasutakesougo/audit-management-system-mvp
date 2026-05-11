## Summary

- Add a kiosk procedure history panel for the procedure detail screen
- Show persisted SharePoint execution records by date
- Add 7-day, 1-month, and 3-month summary previews
- Harden SharePoint history queries when optional row-level fields such as RowNo are missing
- Prevent unresolved field names from being included in `$select`, `$filter`, `$orderby`, or write payloads

## Design notes

History preview uses persisted SharePoint execution records as the source of truth.

The primary matching strategy is user/date-range query + in-app procedure matching by scheduleItemId / normalizedScheduleItemId. `rowNo` is used only when the physical SharePoint field is resolved. If `RowNo` is missing from the environment, the repository falls back to a narrower user/date-range query and excludes `RowNo` from all SharePoint query clauses.

The active kiosk input form remains isolated from history loading failures. If history fetch fails, only the history panel reports the error.

## Checks

- [x] npm run typecheck
- [x] npx vitest run src/features/daily src/features/kiosk
- [x] npx playwright test tests/e2e/kiosk-home-smoke.spec.ts
