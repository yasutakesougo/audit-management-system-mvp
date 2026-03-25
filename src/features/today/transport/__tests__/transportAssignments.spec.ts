import { describe, expect, it } from 'vitest';
import type { TransportLeg } from '../transportTypes';
import {
  buildVehicleBoardGroups,
  buildTransportAssignmentIndex,
  buildVehicleGroups,
  hasMissingVehicleCourse,
  hasMissingVehicleDriver,
  enrichTransportLegsWithAssignments,
} from '../transportAssignments';

const mkLeg = (overrides: Partial<TransportLeg> = {}): TransportLeg => ({
  userId: 'U001',
  userName: '田中太郎',
  direction: 'to',
  method: 'office_shuttle',
  status: 'pending',
  ...overrides,
});

describe('buildTransportAssignmentIndex', () => {
  it('maps transport service rows to inferred direction', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U001',
          serviceType: 'transport',
          start: '2026-03-25T09:15:00+09:00',
          vehicleId: '車両1',
          assignedStaffName: '佐藤花子',
        },
      ],
      () => undefined,
    );

    expect(assignments.to.get('U001')).toEqual({ vehicleId: '車両1', driverName: '佐藤花子' });
    expect(assignments.from.get('U001')).toBeUndefined();
  });

  it('maps pickup rows to both directions and resolves driver from staff id', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U002',
          hasPickup: true,
          vehicleId: '車両2',
          assignedStaffId: 'STF-001',
        },
      ],
      (staffId) => (staffId === 'STF-001' ? '鈴木次郎' : undefined),
    );

    expect(assignments.to.get('U002')).toEqual({ vehicleId: '車両2', driverName: '鈴木次郎' });
    expect(assignments.from.get('U002')).toEqual({ vehicleId: '車両2', driverName: '鈴木次郎' });
  });

  it('resolves attendant from notes marker', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U003',
          hasPickup: true,
          vehicleId: '車両3',
          notes: '玄関前待機 [transport_attendant:STF-010]',
        },
      ],
      (staffId) => (staffId === 'STF-010' ? '伊藤恵' : undefined),
    );

    expect(assignments.to.get('U003')).toEqual({ vehicleId: '車両3', attendantName: '伊藤恵' });
    expect(assignments.from.get('U003')).toEqual({ vehicleId: '車両3', attendantName: '伊藤恵' });
  });

  it('resolves course from notes marker', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U008',
          hasPickup: true,
          vehicleId: '車両1',
          notes: '[transport_course:isogo]',
        },
      ],
      () => undefined,
    );

    expect(assignments.to.get('U008')).toEqual({
      vehicleId: '車両1',
      courseId: 'isogo',
      courseLabel: '磯子',
    });
  });
});

describe('enrichTransportLegsWithAssignments', () => {
  it('fills missing vehicle/driver without overriding existing values', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U001',
          hasPickup: true,
          vehicleId: '車両3',
          assignedStaffName: '高橋三郎',
        },
      ],
      () => undefined,
    );

    const legs = [
      mkLeg({ userId: 'U001', driverName: '既存運転者' }),
      mkLeg({ userId: 'U999' }),
    ];

    const enriched = enrichTransportLegsWithAssignments(legs, assignments);

    expect(enriched[0].vehicleId).toBe('車両3');
    expect(enriched[0].driverName).toBe('既存運転者');
    expect(enriched[1]).toEqual(legs[1]);
  });

  it('fills attendant name and keeps existing attendant', () => {
    const assignments = buildTransportAssignmentIndex(
      [
        {
          userId: 'U004',
          hasPickup: true,
          notes: '[transport_attendant:STF-020]',
        },
      ],
      (staffId) => (staffId === 'STF-020' ? '加藤美咲' : undefined),
    );

    const legs = [
      mkLeg({ userId: 'U004' }),
      mkLeg({ userId: 'U005', attendantName: '既存添乗' }),
    ];

    const enriched = enrichTransportLegsWithAssignments(legs, assignments);
    expect(enriched[0].attendantName).toBe('加藤美咲');
    expect(enriched[1].attendantName).toBe('既存添乗');
  });
});

describe('buildVehicleGroups', () => {
  it('groups riders by vehicle and excludes self/absent', () => {
    const groups = buildVehicleGroups([
      mkLeg({ userId: 'U002', userName: '山田花子', vehicleId: '車両2', driverName: '佐藤' }),
      mkLeg({ userId: 'U001', userName: '田中太郎', vehicleId: '車両1', driverName: '鈴木', status: 'in-progress' }),
      mkLeg({ userId: 'U003', userName: '中村次郎' }),
      mkLeg({ userId: 'U004', userName: '欠席さん', vehicleId: '車両1', status: 'absent' }),
      mkLeg({ userId: 'U005', userName: '自力さん', vehicleId: '車両1', status: 'self' }),
    ]);

    expect(groups.map((group) => group.vehicleId)).toEqual(['車両1', '車両2', '未割当']);
    expect(groups[0].driverName).toBe('鈴木');
    expect(groups[0].attendantName).toBeNull();
    expect(groups[0].riders.map((leg) => leg.userId)).toEqual(['U001']);
    expect(groups[2].riders.map((leg) => leg.userId)).toEqual(['U003']);
  });

  it('keeps attendant name by vehicle', () => {
    const groups = buildVehicleGroups([
      mkLeg({ userId: 'U006', vehicleId: '車両1', driverName: '佐藤', attendantName: '鈴木' }),
      mkLeg({ userId: 'U007', vehicleId: '車両1' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].attendantName).toBe('鈴木');
  });

  it('keeps course label by vehicle', () => {
    const groups = buildVehicleGroups([
      mkLeg({ userId: 'U020', vehicleId: '車両2', courseId: 'kan2', courseLabel: '環2' }),
      mkLeg({ userId: 'U021', vehicleId: '車両2' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].courseId).toBe('kan2');
    expect(groups[0].courseLabel).toBe('環2');
  });
});

describe('buildVehicleBoardGroups', () => {
  it('always shows fixed 4 vehicles with empty rows and keeps unassigned', () => {
    const rows = buildVehicleBoardGroups(
      [
        mkLeg({ userId: 'U010', userName: 'Aさん', vehicleId: '車両2', driverName: '佐藤' }),
        mkLeg({ userId: 'U011', userName: 'Bさん' }), // unassigned
      ],
      ['車両1', '車両2', '車両3', '車両4'],
    );

    expect(rows.map((row) => row.vehicleId)).toEqual(['車両1', '車両2', '車両3', '車両4', '未割当']);
    expect(rows[0].riders).toHaveLength(0);
    expect(rows[1].riders.map((leg) => leg.userId)).toEqual(['U010']);
    expect(rows[1].driverName).toBe('佐藤');
    expect(rows[4].riders.map((leg) => leg.userId)).toEqual(['U011']);
  });

  it('appends non-fixed vehicles after fixed rows', () => {
    const rows = buildVehicleBoardGroups(
      [
        mkLeg({ userId: 'U012', vehicleId: '業務車A', driverName: '鈴木' }),
      ],
      ['車両1', '車両2', '車両3', '車両4'],
    );

    expect(rows.map((row) => row.vehicleId)).toEqual(['車両1', '車両2', '車両3', '車両4', '業務車A']);
    expect(rows[4].driverName).toBe('鈴木');
  });
});

describe('hasMissingVehicleDriver', () => {
  it('returns true only when riders exist and driver is missing', () => {
    expect(hasMissingVehicleDriver({ driverName: null, riders: [mkLeg()] })).toBe(true);
    expect(hasMissingVehicleDriver({ driverName: '佐藤', riders: [mkLeg()] })).toBe(false);
    expect(hasMissingVehicleDriver({ driverName: null, riders: [] })).toBe(false);
  });
});

describe('hasMissingVehicleCourse', () => {
  it('returns true only when riders exist and course is missing', () => {
    expect(hasMissingVehicleCourse({ courseId: null, courseLabel: null, riders: [mkLeg()] })).toBe(true);
    expect(hasMissingVehicleCourse({ courseId: 'isogo', courseLabel: '磯子', riders: [mkLeg()] })).toBe(false);
    expect(hasMissingVehicleCourse({ courseId: null, courseLabel: null, riders: [] })).toBe(false);
  });
});
