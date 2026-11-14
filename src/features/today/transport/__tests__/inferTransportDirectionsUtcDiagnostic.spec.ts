import { describe, expect, it } from 'vitest';
import { inferTransportDirections } from '../transportAssignments';

/**
 * GO-E reproduction evidence, kept after the GO-F fix.
 *
 * Before the fix, `parseHour` used `Date.getHours()`.
 * `2026-03-24T23:30:00.000Z` is JST 2026-03-25 08:30, and the business
 * direction for that morning transport is `to`.
 * Under `TZ=UTC`, `Date.getHours()` returned 23, so a plain title 「送迎」
 * was classified as `['from']` and failed the outbound filter
 * `inferTransportDirections(row).includes('to')`.
 * The same instant with title 「送迎（往路）」 stayed `['to']`, because
 * title patterns are checked before the hour.
 *
 * GO-F reads the hour in Asia/Tokyo. These expectations are the business
 * result and must match under both `TZ=UTC` and `TZ=Asia/Tokyo`.
 */
const PLAIN_TITLE = '送迎';

function rowAt(start: string, title = PLAIN_TITLE) {
  return {
    title,
    serviceType: 'transport',
    userId: 'U002',
    start,
  };
}

describe('inferTransportDirections JST hour', () => {
  it.each([
    ['JST 08:30', '2026-03-24T23:30:00.000Z', PLAIN_TITLE, ['to']],
    ['JST 16:00', '2026-03-25T07:00:00.000Z', PLAIN_TITLE, ['from']],
    ['JST 12:59', '2026-03-25T03:59:00.000Z', PLAIN_TITLE, ['to']],
    ['JST 13:00', '2026-03-25T04:00:00.000Z', PLAIN_TITLE, ['from']],
    ['JST 08:30', '2026-03-24T23:30:00.000Z', '送迎（往路）', ['to']],
    ['JST 16:00', '2026-03-25T07:00:00.000Z', '送迎（復路）', ['from']],
  ] as const)('%s %s is %j', (_label, start, title, expected) => {
    expect(inferTransportDirections(rowAt(start, title))).toEqual(expected);
  });
});
