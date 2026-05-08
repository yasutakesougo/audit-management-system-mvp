## Summary
- add Shiota-specific 17-row procedure details
- preserve line breaks from the Excel / fixture source data
- add Shiota-specific daily care points and other notes
- add Shiota user ID alias resolution (`I016`, and related runtime ID if applicable)
- add mapper coverage for Shiota row details, sheet-level notes, and alias resolution
- document the production user ID alias map and operating rules in the support procedure addition guide

## Why
The support procedure flow separates the shared 17-row skeleton, user-specific row details, and sheet-level footer remarks. This PR applies the established pattern to Shiota-san and documents the ID alias map so future user additions follow the same safe process.

## Checks
- `npx vitest run src/features/planning-sheet/logic/__tests__/dailyProcedureMapper.spec.ts`
- `npx vitest run src/features/planning-sheet`
- `npm run typecheck`
