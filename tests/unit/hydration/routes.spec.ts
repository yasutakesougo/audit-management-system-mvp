import { describe, expect, it } from 'vitest';

import { HYDRATION_KEYS, resolveHydrationEntry } from '@/hydration/routes';

describe('resolveHydrationEntry', () => {
  it.each([
    ['/', '', HYDRATION_KEYS.dashboard],
    ['/records', '', HYDRATION_KEYS.records],
    ['/records/support-procedures', '', HYDRATION_KEYS.supportProcedures],
    ['/audit/logs', '', HYDRATION_KEYS.audit],
    ['/users', '', HYDRATION_KEYS.users],
    ['/staff/', '', HYDRATION_KEYS.staff],
    ['/schedules/week', '', HYDRATION_KEYS.schedulesWeek],
    ['/schedules/month', '', HYDRATION_KEYS.schedulesMonth],
    ['/schedules/create', '', HYDRATION_KEYS.schedulesCreate],
    ['/schedules/week', '?view=day', HYDRATION_KEYS.schedulesDay],
    ['/schedules/week', '?view=DAY', HYDRATION_KEYS.schedulesDay],
    ['/daily', '', HYDRATION_KEYS.dailyMenu],
    ['/daily/support', '', HYDRATION_KEYS.dailySupport],
    ['/daily/activity', '', HYDRATION_KEYS.dailyActivity],
    ['/admin/templates', '', HYDRATION_KEYS.adminTemplates],
    ['/admin/step-templates', '', HYDRATION_KEYS.adminSteps],
    ['/admin/individual-support', '', HYDRATION_KEYS.adminIndividualSupport],
  ])('resolves %s%s to %s', (pathname, search, expected) => {
    const entry = resolveHydrationEntry(pathname, search);
    expect(entry).toEqual(expected);
  });

  it('normalises casing and trailing slash', () => {
    const entry = resolveHydrationEntry('/DAILY/Support/', '');
    expect(entry).toEqual(HYDRATION_KEYS.dailySupport);
  });

  it('supports paths without a leading slash', () => {
    const entry = resolveHydrationEntry('schedules/week', '');
    expect(entry).toEqual(HYDRATION_KEYS.schedulesWeek);
  });

  it('returns null for unmatched paths', () => {
    expect(resolveHydrationEntry('/unknown')).toBeNull();
  });
});
