## Summary

- Add ABC record CTA from Kiosk procedure list and procedure detail screens
- Navigate to Dedicated ABC (`/abc-record`) with deep link query parameters
- Preserve `userId`, `source`, `date`, `slotId`, and `returnUrl`
- Pass `draftBehavior` / `draftSlotId` via navigation state
- Align Kiosk CTA labels with Entry Consolidation Rule: procedure detail is the primary entry, list CTA is secondary guidance

## Scope

Phase 1: deep link only / no sync

This PR only adds navigation from Kiosk to Dedicated ABC (`/abc-record`).
Created records are saved to `AbcBehaviorRecords`.
This PR does not sync or duplicate records into `DailyActivityRecords`.

## Acceptance Criteria

- Kiosk procedure list can navigate to `/abc-record`
- Kiosk procedure slot rows can navigate to `/abc-record`
- Kiosk procedure detail can navigate to `/abc-record`
- Deep link preserves `userId`, `date`, `slotId`, `source`, and `returnUrl`
- `returnUrl` and `slotId` are encoded via `URLSearchParams`
- Saved records are treated as Dedicated ABC records
- No expectation that records appear in Daily Behavior / `DailyActivityRecords`

## Review Notes

This follows `docs/architecture/abc-record-boundary.md`.

Kiosk-originated ABC records created through `/abc-record` are Dedicated ABC records in Phase 1.
Procedure detail is the primary entry. List-level CTA is secondary guidance.

## Checks

- `npm run -s typecheck`
