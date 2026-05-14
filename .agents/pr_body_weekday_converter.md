## Summary
- Add weekday conversion helper for monthly plannedRows calculation
- Support Japanese weekday labels and canonical weekday keys
- Add unit tests for valid and invalid conversions

## Scope
- Utility/helper only
- No SharePoint schema changes
- No persistence changes
- No aggregation behavior changes by itself

## Checks
- npm run typecheck
- npx vitest run src/features/records/monthly/__tests__/plannedRowsCalculator.spec.ts src/features/records/monthly/utils/__tests__/weekdayConverter.spec.ts
