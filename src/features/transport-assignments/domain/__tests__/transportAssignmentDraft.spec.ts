import { describe, expect, it } from 'vitest';
import type { TransportDirection } from '@/features/today/transport/transportTypes';
import {
  assignUserToVehicle,
  buildSchedulePatchPayloads,
  buildTransportAssignmentDraft,
  hasVehicleMissingDriver,
  removeUserFromVehicle,
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
