import { describe, expect, it } from 'vitest';
import { getKioskQuickLinks } from './getKioskQuickLinks';

const baseFlags = {
  schedules: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  todayOps: true,
  todayLiteUi: false,
  todayLiteNavV2: false,
} as const;

describe('getKioskQuickLinks', () => {
  it('returns all default links when schedules is enabled', () => {
    const links = getKioskQuickLinks({
      role: 'viewer',
      flags: { ...baseFlags },
    });

    expect(links.map((link) => link.id)).toEqual([
      'schedule',
      'handoff',
      'minutes',
      'room',
      'briefing',
    ]);
  });

  it('hides schedule link when schedules flag is disabled', () => {
    const links = getKioskQuickLinks({
      role: 'viewer',
      flags: { ...baseFlags, schedules: false },
    });

    expect(links.map((link) => link.id)).toEqual([
      'handoff',
      'minutes',
      'room',
      'briefing',
    ]);
  });
});

