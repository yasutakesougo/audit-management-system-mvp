import { describe, expect, it } from 'vitest';
import type { TransportDirection } from '@/features/today/transport/transportTypes';
import {
  applyPreviousWeekdayDefaults,
  assignUserToVehicle,
  buildSchedulePatchPayloads,
  buildTransportAssignmentDraft,
  hasVehicleMissingDriver,
  removeUserFromVehicle,
  resolveDefaultTransportCourse,
} from '../transportAssignmentDraft';

type RowOverrides = Partial<{
  id: string;
  etag: string;
  title: string;
  category: string;
  start: string;
  end: string;
  serviceType: string;
  userId: string;
  userName: string;
  assignedStaffId: string;
  assignedStaffName: string;
  vehicleId: string;
  notes: string;
  hasPickup: boolean;
}>;

const mkRow = (overrides: RowOverrides = {}) => ({
  id: 'row-1',
  etag: '"1"',
  title: '送迎（往路）',
  category: 'User',
  start: '2026-03-25T09:00:00+09:00',
  end: '2026-03-25T09:30:00+09:00',
  serviceType: 'transport',
  userId: 'U001',
  userName: '田中太郎',
  assignedStaffId: undefined,
  assignedStaffName: undefined,
  vehicleId: undefined,
  notes: undefined,
  hasPickup: false,
  ...overrides,
});

const buildDraft = (direction: TransportDirection = 'to') =>
  buildTransportAssignmentDraft({
    date: '2026-03-25',
    direction,
    schedules: [
      mkRow({
        id: 'row-to-1',
        userId: 'U001',
        userName: '田中太郎',
        vehicleId: '車両2',
        assignedStaffId: 'STF-001',
        assignedStaffName: '',
      }),
      mkRow({
        id: 'row-to-2',
        userId: 'U002',
        userName: '山田花子',
        title: '送迎（往路）',
      }),
      mkRow({
        id: 'row-from-1',
        userId: 'U003',
        userName: '中村次郎',
        title: '送迎（復路）',
        vehicleId: '車両4',
      }),
    ],
    users: [
      { userId: 'U001', userName: '田中太郎' },
      { userId: 'U002', userName: '山田花子' },
      { userId: 'U003', userName: '中村次郎' },
    ],
    staff: [
      { id: 1, staffId: 'STF-001', name: '佐藤花子' },
      { id: 2, staffId: 'STF-002', name: '鈴木次郎' },
    ],
    fixedVehicleIds: ['車両1', '車両2', '車両3', '車両4'],
  });

describe('buildTransportAssignmentDraft', () => {
  it('builds direction-specific draft with fixed vehicles and unassigned users', () => {
    const draft = buildDraft('to');

    expect(draft.users.map((user) => user.userId)).toEqual(['U002', 'U001']);
    expect(draft.vehicles.map((vehicle) => vehicle.vehicleId)).toEqual(['車両1', '車両2', '車両3', '車両4']);
    expect(draft.vehicles[1].riderUserIds).toEqual(['U001']);
    expect(draft.vehicles[1].driverStaffId).toBe('STF-001');
    expect(draft.vehicles[1].driverName).toBe('佐藤花子');
    expect(draft.unassignedUserIds).toEqual(['U002']);
  });

  it('restores attendant from notes marker', () => {
    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules: [
        mkRow({
          id: 'row-to-attendant',
          userId: 'U001',
          userName: '田中太郎',
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
          notes: '玄関前待機 [transport_attendant:STF-002] [transport_course:kan2]',
        }),
      ],
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [
        { staffId: 'STF-001', name: '佐藤花子' },
        { staffId: 'STF-002', name: '鈴木次郎' },
      ],
      fixedVehicleIds: ['車両2'],
    });

    expect(draft.vehicles[0]).toMatchObject({
      vehicleId: '車両2',
      driverStaffId: 'STF-001',
      attendantStaffId: 'STF-002',
      attendantName: '鈴木次郎',
      courseId: 'kan2',
      courseLabel: '環2',
    });
  });

  it('ignores schedules from other dates', () => {
    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules: [
        mkRow({
          id: 'row-target-date',
          userId: 'U001',
          userName: '田中太郎',
          start: '2026-03-25T09:00:00+09:00',
          end: '2026-03-25T09:30:00+09:00',
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
        }),
        mkRow({
          id: 'row-other-date',
          userId: 'U002',
          userName: '山田花子',
          start: '2026-03-26T09:00:00+09:00',
          end: '2026-03-26T09:30:00+09:00',
          vehicleId: '車両3',
          assignedStaffId: 'STF-002',
        }),
      ],
      users: [
        { userId: 'U001', userName: '田中太郎' },
        { userId: 'U002', userName: '山田花子' },
      ],
      staff: [
        { staffId: 'STF-001', name: '佐藤花子' },
        { staffId: 'STF-002', name: '鈴木次郎' },
      ],
      fixedVehicleIds: ['車両1', '車両2', '車両3', '車両4'],
    });

    expect(draft.users.map((user) => user.userId)).toEqual(['U001']);
    expect(draft.vehicles.find((vehicle) => vehicle.vehicleId === '車両2')?.riderUserIds).toEqual(['U001']);
    expect(draft.vehicles.find((vehicle) => vehicle.vehicleId === '車両3')?.riderUserIds).toEqual([]);
  });
});

describe('assignUserToVehicle / removeUserFromVehicle', () => {
  it('moves users between vehicle and unassigned without duplicates', () => {
    const draft = buildDraft('to');

    const assigned = assignUserToVehicle(draft, 'U002', '車両1');
    expect(assigned.vehicles[0].riderUserIds).toEqual(['U002']);
    expect(assigned.unassignedUserIds).toEqual([]);

    const removed = removeUserFromVehicle(assigned, 'U001');
    expect(removed.vehicles[1].riderUserIds).toEqual([]);
    expect(removed.unassignedUserIds).toEqual(['U001']);
  });
});

describe('buildSchedulePatchPayloads', () => {
  it('builds update payloads only for changed rows in selected direction', () => {
    const baseDraft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules: [
        mkRow({
          id: 'row-to-1',
          userId: 'U001',
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
        }),
        mkRow({
          id: 'row-to-2',
          userId: 'U002',
          hasPickup: true,
        }),
        mkRow({
          id: 'row-from-2',
          userId: 'U002',
          title: '送迎（復路）',
          vehicleId: '車両4',
        }),
      ],
      users: [
        { userId: 'U001', userName: '田中太郎' },
        { userId: 'U002', userName: '山田花子' },
      ],
      staff: [{ staffId: 'STF-002', name: '鈴木次郎' }],
      fixedVehicleIds: ['車両1', '車両2', '車両3', '車両4'],
    });

    let next = assignUserToVehicle(baseDraft, 'U001', '車両1');
    next = assignUserToVehicle(next, 'U002', '車両3');
    next = {
      ...next,
      vehicles: next.vehicles.map((vehicle) =>
        vehicle.vehicleId === '車両3'
          ? { ...vehicle, driverStaffId: 'STF-002', driverName: '鈴木次郎' }
          : vehicle,
      ),
    };

    const payloads = buildSchedulePatchPayloads({
      draft: next,
      schedules: [
        mkRow({
          id: 'row-to-1',
          userId: 'U001',
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
        }),
        mkRow({
          id: 'row-to-2',
          userId: 'U002',
          hasPickup: true,
        }),
        mkRow({
          id: 'row-from-2',
          userId: 'U002',
          title: '送迎（復路）',
          vehicleId: '車両4',
        }),
      ],
    });

    expect(payloads.map((payload) => payload.id)).toEqual(['row-to-1', 'row-to-2']);
    expect(payloads[0]).toMatchObject({
      id: 'row-to-1',
      vehicleId: '車両1',
      assignedStaffId: '',
      category: 'User',
      startLocal: '2026-03-25T09:00:00+09:00',
      endLocal: '2026-03-25T09:30:00+09:00',
    });
    expect(payloads[1]).toMatchObject({
      id: 'row-to-2',
      vehicleId: '車両3',
      assignedStaffId: 'STF-002',
    });
  });

  it('returns empty payload when draft matches current assignment', () => {
    const draft = buildDraft('to');
    const payloads = buildSchedulePatchPayloads({
      draft,
      schedules: [
        mkRow({
          id: 'row-to-1',
          userId: 'U001',
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
        }),
        mkRow({
          id: 'row-to-2',
          userId: 'U002',
        }),
      ],
    });

    expect(payloads).toHaveLength(0);
  });

  it('updates notes marker when attendant changes', () => {
    const schedules = [
      mkRow({
        id: 'row-to-attendant',
        userId: 'U001',
        vehicleId: '車両2',
        assignedStaffId: 'STF-001',
        notes: '玄関前待機 [transport_attendant:STF-001]',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [
        { staffId: 'STF-001', name: '佐藤花子' },
        { staffId: 'STF-002', name: '鈴木次郎' },
      ],
      fixedVehicleIds: ['車両2'],
    });

    const changed = {
      ...draft,
      vehicles: draft.vehicles.map((vehicle) =>
        vehicle.vehicleId === '車両2'
          ? {
              ...vehicle,
              attendantStaffId: 'STF-002',
              attendantName: '鈴木次郎',
            }
          : vehicle,
      ),
    };
    const payloads = buildSchedulePatchPayloads({ draft: changed, schedules });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      id: 'row-to-attendant',
      vehicleId: undefined,
      assignedStaffId: undefined,
    });
    expect(payloads[0].notes).toBe('玄関前待機 [transport_attendant:STF-002]');
  });

  it('updates notes marker when course changes', () => {
    const schedules = [
      mkRow({
        id: 'row-to-course',
        userId: 'U001',
        vehicleId: '車両2',
        assignedStaffId: 'STF-001',
        notes: '玄関前待機 [transport_course:isogo]',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [{ staffId: 'STF-001', name: '佐藤花子' }],
      fixedVehicleIds: ['車両2'],
    });

    const changed = {
      ...draft,
      vehicles: draft.vehicles.map((vehicle) =>
        vehicle.vehicleId === '車両2'
          ? {
              ...vehicle,
              courseId: 'kanazawa' as const,
              courseLabel: '金沢' as const,
            }
          : vehicle,
      ),
    };
    const payloads = buildSchedulePatchPayloads({ draft: changed, schedules });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      id: 'row-to-course',
      vehicleId: undefined,
      assignedStaffId: undefined,
    });
    expect(payloads[0].notes).toBe('玄関前待機 [transport_course:kanazawa]');
  });

  it('does not build payloads for schedules outside draft date', () => {
    const schedules = [
      mkRow({
        id: 'row-target',
        userId: 'U001',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
        vehicleId: '車両2',
      }),
      mkRow({
        id: 'row-other',
        userId: 'U001',
        start: '2026-03-26T09:00:00+09:00',
        end: '2026-03-26T09:30:00+09:00',
        vehicleId: '車両2',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [],
      fixedVehicleIds: ['車両1', '車両2'],
    });

    const changed = assignUserToVehicle(draft, 'U001', '車両1');
    const payloads = buildSchedulePatchPayloads({
      draft: changed,
      schedules,
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].id).toBe('row-target');
  });
});

describe('applyPreviousWeekdayDefaults', () => {
  it('applies latest same-weekday defaults to users who are unassigned on target date', () => {
    const schedules = [
      mkRow({
        id: 'row-target-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
      }),
      mkRow({
        id: 'row-target-u002',
        userId: 'U002',
        userName: '山田花子',
        start: '2026-03-25T09:15:00+09:00',
        end: '2026-03-25T09:45:00+09:00',
      }),
      mkRow({
        id: 'row-prev-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-18T09:00:00+09:00',
        end: '2026-03-18T09:30:00+09:00',
        vehicleId: '車両2',
        assignedStaffId: 'STF-001',
        assignedStaffName: '佐藤花子',
        notes: '[transport_attendant:STF-002]',
      }),
      mkRow({
        id: 'row-prev-u002',
        userId: 'U002',
        userName: '山田花子',
        start: '2026-03-18T09:10:00+09:00',
        end: '2026-03-18T09:40:00+09:00',
        vehicleId: '車両3',
        assignedStaffId: 'STF-003',
        assignedStaffName: '高橋一郎',
      }),
      mkRow({
        id: 'row-older-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-11T09:00:00+09:00',
        end: '2026-03-11T09:30:00+09:00',
        vehicleId: '車両4',
        assignedStaffId: 'STF-004',
      }),
      mkRow({
        id: 'row-other-weekday',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-24T09:00:00+09:00',
        end: '2026-03-24T09:30:00+09:00',
        vehicleId: '車両1',
        assignedStaffId: 'STF-010',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [
        { userId: 'U001', userName: '田中太郎' },
        { userId: 'U002', userName: '山田花子' },
      ],
      staff: [],
      fixedVehicleIds: ['車両1', '車両2', '車両3', '車両4'],
    });

    const applied = applyPreviousWeekdayDefaults({
      draft,
      schedules,
    });

    const vehicle2 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両2');
    const vehicle3 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両3');

    expect(vehicle2).toMatchObject({
      riderUserIds: ['U001'],
      driverStaffId: 'STF-001',
      attendantStaffId: 'STF-002',
    });
    expect(vehicle3).toMatchObject({
      riderUserIds: ['U002'],
      driverStaffId: 'STF-003',
    });
  });

  it('does not override assignment already set on target date', () => {
    const schedules = [
      mkRow({
        id: 'row-target',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
        vehicleId: '車両1',
        assignedStaffId: 'STF-001',
      }),
      mkRow({
        id: 'row-prev',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-18T09:00:00+09:00',
        end: '2026-03-18T09:30:00+09:00',
        vehicleId: '車両2',
        assignedStaffId: 'STF-999',
        notes: '[transport_attendant:STF-888]',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [],
      fixedVehicleIds: ['車両1', '車両2'],
    });

    const applied = applyPreviousWeekdayDefaults({
      draft,
      schedules,
    });

    const vehicle1 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両1');
    const vehicle2 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両2');
    expect(vehicle1).toMatchObject({
      riderUserIds: ['U001'],
      driverStaffId: 'STF-001',
    });
    expect(vehicle2?.riderUserIds).toEqual([]);
  });

  it('prioritizes fixed user course over same-weekday history when course is unset', () => {
    const schedules = [
      mkRow({
        id: 'row-target-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
      }),
      mkRow({
        id: 'row-prev-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-18T09:00:00+09:00',
        end: '2026-03-18T09:30:00+09:00',
        vehicleId: '車両2',
        assignedStaffId: 'STF-001',
        notes: '[transport_course:kan2]',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [],
      fixedVehicleIds: ['車両1', '車両2'],
    });

    const applied = applyPreviousWeekdayDefaults({
      draft,
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎', fixedCourseId: 'isogo' }],
    });

    const vehicle2 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両2');
    expect(vehicle2).toMatchObject({
      riderUserIds: ['U001'],
      courseId: 'isogo',
      courseLabel: '磯子',
      driverStaffId: 'STF-001',
    });
  });

  it('does not override course already set on target date even when fixed course exists', () => {
    const schedules = [
      mkRow({
        id: 'row-target-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
        vehicleId: '車両1',
        notes: '[transport_course:kanazawa]',
      }),
      mkRow({
        id: 'row-prev-u001',
        userId: 'U001',
        userName: '田中太郎',
        start: '2026-03-18T09:00:00+09:00',
        end: '2026-03-18T09:30:00+09:00',
        vehicleId: '車両2',
        notes: '[transport_course:kan2]',
      }),
    ];

    const draft = buildTransportAssignmentDraft({
      date: '2026-03-25',
      direction: 'to',
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎' }],
      staff: [],
      fixedVehicleIds: ['車両1', '車両2'],
    });

    const applied = applyPreviousWeekdayDefaults({
      draft,
      schedules,
      users: [{ userId: 'U001', userName: '田中太郎', fixedCourseId: 'isogo' }],
    });

    const vehicle1 = applied.vehicles.find((vehicle) => vehicle.vehicleId === '車両1');
    expect(vehicle1).toMatchObject({
      riderUserIds: ['U001'],
      courseId: 'kanazawa',
      courseLabel: '金沢',
    });
  });
});

describe('resolveDefaultTransportCourse', () => {
  it('returns fixed course first, then history, then null', () => {
    expect(
      resolveDefaultTransportCourse(
        { fixedCourseId: 'isogo', fixedCourseLabel: '磯子' },
        { courseId: 'kan2' },
      ),
    ).toBe('isogo');

    expect(
      resolveDefaultTransportCourse(
        { fixedCourseId: null, fixedCourseLabel: null },
        { courseId: 'kan2' },
      ),
    ).toBe('kan2');

    expect(
      resolveDefaultTransportCourse(
        { fixedCourseId: null, fixedCourseLabel: null },
        { courseId: null },
      ),
    ).toBeNull();
  });
});

describe('hasVehicleMissingDriver', () => {
  it('returns true when riders exist but driver is missing', () => {
    expect(
      hasVehicleMissingDriver({
        riderUserIds: ['U001'],
        driverStaffId: null,
        driverName: null,
      }),
    ).toBe(true);
  });

  it('returns false when driver is set or riders are empty', () => {
    expect(
      hasVehicleMissingDriver({
        riderUserIds: ['U001'],
        driverStaffId: 'STF-001',
        driverName: null,
      }),
    ).toBe(false);
    expect(
      hasVehicleMissingDriver({
        riderUserIds: [],
        driverStaffId: null,
        driverName: null,
      }),
    ).toBe(false);
  });
});
