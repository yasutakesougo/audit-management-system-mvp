## Summary
- Add Today monitoring governance alert builder
- Reuse Support Date Governance resolution logic from planning-sheet
- Replace direct ServiceStartDate reads with Planning Sheet > User Master > appliedFrom resolution
- Add Today signals for provisional / unset / invalid monitoring origins
- Convert overdue / dueSoon / unset / invalid monitoring signals into monitoring_deadline action sources
- Keep provisional-only signals out of the priority Action Queue to avoid noisy daily actions
- Add tests for Today alert classification and signal mapping

## Design note
Today does not own or store the monitoring origin.
Today consumes the L2-owned resolved origin and surfaces operational alerts.

Resolution priority remains:
1. SupportPlanningSheet.SupportStartDate
2. UserMaster.ServiceStartDate
3. appliedFrom as provisional fallback

Display rule:
- overdue / dueSoon / unset / invalid are surfaced as priority actions
- provisional-only is retained as a signal but not promoted to the Action Queue
- provisional + dueSoon / overdue is surfaced through the due/overdue monitoring action

## Checks
- npm run typecheck
- npx vitest run src/features/today
- npx vitest run src/features/planning-sheet/__tests__/monitoringSchedule.spec.ts
- npx vitest run src/features/daily/components/__tests__/MonitoringCountdown.spec.tsx