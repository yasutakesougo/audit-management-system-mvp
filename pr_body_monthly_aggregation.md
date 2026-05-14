## Summary
- Replace demo-only monthly summaries with useMonthlySummaries
- Aggregate monthly KPIs from SharePoint execution records in production mode
- Keep demo summaries available in demo mode
- Add production/demo status chip and manual re-aggregation button
- Keep last 12 months selectable even before summary data exists

## Scope
- Monthly record page only
- No Business Journal Preview wiring in this PR
- No SharePoint schema changes

## Checks
- Verify production mode shows 本番データ
- Verify users are loaded from Users_Master
- Verify 再集計 refreshes aggregation from SupportRecord_Daily
- Verify demo mode still uses seed data
