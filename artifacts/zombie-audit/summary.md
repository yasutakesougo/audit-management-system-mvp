# Zombie Column Audit — Summary

**Scan timestamp**: 2026-04-11T10:29:18.707Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694

## Per-list counts

| List | Total | keep_ssot | keep_system | drift_suffix | drift_encoded | legacy_unknown |
|---|---|---|---|---|---|---|
| [SupportProcedure_Results](./SupportProcedure_Results.md) | 86 | 1 | 85 | 0 | 0 | 0 |
| [Approval_Logs](./Approval_Logs.md) | 90 | 5 | 85 | 0 | 0 | 0 |
| [User_Feature_Flags](./User_Feature_Flags.md) | 89 | 4 | 85 | 0 | 0 | 0 |
| [SupportRecord_Daily](./SupportRecord_Daily.md) | 130 | 6 | 85 | 0 | 26 | 13 |

## Next steps

1. Review each list's `.md` report and confirm the deletion candidates.
2. For `legacy_unknown` rows, trace usage via `git log -S` before deciding.
3. Once confirmed, either:
   - Use the SharePoint UI to delete columns manually (safest), or
   - Run `node scripts/ops/zombie-column-purger.mjs --force` (⚠️ deletes columns matching the hardcoded `TARGETS.patterns` — not the audit output).
4. After deletion, re-run bootstrap and confirm `sp:provision_partial` no longer fires for these lists.

