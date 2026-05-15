## Summary

- Persist selected record date onto DailyRecordRows child payload
- Resolve child date field via DailyRecordSchemaResolver
- Use parent RecordDate value for child recordDate
- Add schema drift regression test for rows date field resolved as Date

## Why

DailyRecordRows child rows were saved successfully, but child payload did not include Date/RecordDate.
As a result, I005 rows could increase in total count while I005/2026-05 could not be proven for monthly KPI reconciliation.

## Checks

- npm run typecheck
- npx vitest run src/features/daily
- npx vitest run src/features/records/monthly

## Non-goals

- No plannedRows formula changes
- No monthly aggregation redesign
- No SharePoint provisioning
- No Dedicated ABC / DailyActivityRecords integration
- No auth or spFetch retry changes
