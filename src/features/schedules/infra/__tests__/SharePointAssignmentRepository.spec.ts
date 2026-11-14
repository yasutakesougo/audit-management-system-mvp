import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointAssignmentRepository } from '../SharePointAssignmentRepository';
import { ScheduleConflictError, type ScheduleRepository } from '../../domain/ScheduleRepository';
import { isUsableAssignmentEtag, nextUnresolvedAssignmentSave, readAssignmentSaveReport, sealAssignmentFields } from '../assignmentSaveReport';
import type { TransportAssignment } from '../../domain/assignment';
import { emitTelemetry } from '@/lib/telemetry';

vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn(),
}));

function bindLiveSchedule(scheduleRepo: ScheduleRepository, initial: Array<Record<string, unknown>>) {
  let rows = initial.map((row) => ({ ...row }));
  vi.mocked(scheduleRepo.list).mockImplementation(async () => rows.map((row) => ({ ...row })) as never);
  vi.mocked(scheduleRepo.update).mockImplementation(async (input) => {
    rows = rows.map((row) => row.id === input.id
      ? {
          ...row,
          vehicleId: input.vehicleId,
          assignedStaffId: input.assignedStaffId,
          notes: input.notes,
          etag: input.etag ?? row.etag,
        }
      : row);
    return input as never;
  });
  installRowEtag(scheduleRepo, () => rows as never);
}

function installRowEtag(
  scheduleRepo: ScheduleRepository,
  rows: () => Array<Record<string, unknown>>,
) {
  (scheduleRepo as ScheduleRepository & {
    readTransportRowEtag: (id: string) => Promise<{ etag: string; item: Record<string, unknown> } | null>;
  }).readTransportRowEtag = async (id: string) => {
    const item = rows().find((row) => String(row.id) === id);
    const etag = typeof item?.etag === 'string' ? item.etag : '';
    if (!item || !isUsableAssignmentEtag(etag, id)) return null;
    return { etag, item };
  };
}

describe('SharePointAssignmentRepository', () => {
  const mockScheduleRepo = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as ScheduleRepository;

  const repo = new SharePointAssignmentRepository(mockScheduleRepo);

  it('should group transport schedule items by vehicleId', async () => {
    // Mock data with different users assigned to the same vehicle
    const mockItems = [
      {
        id: '1',
        title: '送迎',
        userId: 'user1',
        vehicleId: 'VehicleA',
        start: '2026-04-23T08:00:00+09:00',
        end: '2026-04-23T09:00:00+09:00',
        serviceType: 'transport',
        assignedStaffId: 'staff1',
        notes: '[transport_attendant:staff2]',
      },
      {
        id: '2',
        title: '送迎',
        userId: 'user2',
        vehicleId: 'VehicleA',
        start: '2026-04-23T08:00:00+09:00',
        end: '2026-04-23T09:00:00+09:00',
        serviceType: 'transport',
        assignedStaffId: 'staff1',
      },
      {
        id: '3',
        title: '送迎',
        userId: 'user3',
        vehicleId: 'VehicleB',
        start: '2026-04-23T08:00:00+09:00',
        end: '2026-04-23T09:00:00+09:00',
        serviceType: 'transport',
        assignedStaffId: 'staff3',
      }
    ];

    vi.mocked(mockScheduleRepo.list).mockResolvedValue(mockItems as never);

    const results = await repo.list({
      type: 'transport',
      range: { from: '2026-04-23T00:00:00Z', to: '2026-04-23T23:59:59Z' }
    });

    expect(results).toHaveLength(2);
    
    const vehicleA = results.find(a => (a as TransportAssignment).vehicleId === 'VehicleA') as TransportAssignment;
    expect(vehicleA).toBeDefined();
    expect(vehicleA?.userIds).toContain('user1');
    expect(vehicleA?.userIds).toContain('user2');
    expect(vehicleA?.driverId).toBe('staff1');
    expect(vehicleA?.assistantStaffIds).toContain('staff2');

    const vehicleB = results.find(a => (a as TransportAssignment).vehicleId === 'VehicleB') as TransportAssignment;
    expect(vehicleB).toBeDefined();
    expect(vehicleB?.userIds).toEqual(['user3']);
    expect(vehicleB?.driverId).toBe('staff3');
  });

  describe('saveBulk: retry-with-merge on 412 conflicts', () => {
    const baseItem = {
      id: 'sched-1',
      title: '送迎',
      userId: 'user1',
      vehicleId: 'VehicleA',
      assignedStaffId: 'staffOld',
      serviceType: 'transport',
      start: '2026-04-25T08:00:00+09:00',
      end: '2026-04-25T09:00:00+09:00',
      notes: '',
      etag: '"v1"',
    };

    const targetAssignment: TransportAssignment = {
      id: 'transport-2026-04-25-to-VehicleA',
      type: 'transport',
      start: '2026-04-25T08:00:00+09:00',
      end: '2026-04-25T09:00:00+09:00',
      title: '送迎: VehicleA',
      status: 'planned',
      vehicleId: 'VehicleA',
      driverId: 'staffNew',
      assistantStaffIds: [],
      userIds: ['user1'],
      direction: 'to',
    };

    let scheduleRepo: ScheduleRepository;
    let repo: SharePointAssignmentRepository;

    beforeEach(() => {
      vi.mocked(emitTelemetry).mockClear();
      scheduleRepo = {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      } as unknown as ScheduleRepository;
      repo = new SharePointAssignmentRepository(scheduleRepo);
    });

    it('updates normally when no conflict occurs (no retry telemetry)', async () => {
      bindLiveSchedule(scheduleRepo, [baseItem]);

      await repo.saveBulk([targetAssignment]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(emitTelemetry).not.toHaveBeenCalled();
    });

    it('writes an assignment course tag onto a row that does not have one', async () => {
      bindLiveSchedule(scheduleRepo, [baseItem]);

      await repo.saveBulk([{
        ...targetAssignment,
        notes: '[transport_course:isogo]',
      }]);

      const payload = vi.mocked(scheduleRepo.update).mock.calls[0][0];
      expect(payload.notes).toContain('[transport_course:isogo]');
      expect(payload.assignedStaffId).toBe('staffNew');
    });

    it('keeps the row course when the assignment does not specify one', async () => {
      const rowWithCourse = {
        ...baseItem,
        notes: '玄関前待機 [transport_course:isogo]',
      };
      bindLiveSchedule(scheduleRepo, [rowWithCourse]);

      await repo.saveBulk([targetAssignment]);

      const payload = vi.mocked(scheduleRepo.update).mock.calls[0][0];
      expect(payload.notes).toContain('[transport_course:isogo]');
      expect(payload.notes).toContain('玄関前待機');
    });

    it('stops on 412 without replaying the assignment body', async () => {
      installRowEtag(scheduleRepo, () => [baseItem]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValue(new ScheduleConflictError());

      await expect(repo.saveBulk([targetAssignment])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(scheduleRepo.update).mock.calls[0][0];
      expect(payload.etag).toBe('"v1"');
      expect(payload.assignedStaffId).toBe('staffNew');
      expect(payload).not.toHaveProperty('startLocal');
      expect(payload).not.toHaveProperty('title');
      expect(vi.mocked(scheduleRepo.update).mock.calls[0][1]).toEqual({
        assignmentWrite: { conflictRetry: 'none' },
        signal: undefined,
      });
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({ itemId: 'sched-1', reason: 'conflict', retryCount: 0 }),
      );
    });

    it.each([
      { label: 'user', fresh: { userId: 'user-other' } },
      {
        label: 'date',
        fresh: { start: '2026-04-26T08:00:00+09:00', end: '2026-04-26T09:00:00+09:00' },
      },
      { label: 'direction', fresh: { title: '送り送迎' } },
      { label: 'eligibility', fresh: { serviceType: 'meeting', title: '会議' } },
    ])('does not update a refetched row when the $label no longer matches', async ({ fresh }) => {
      const mismatched = { ...baseItem, etag: '"v2"', ...fresh };
      installRowEtag(scheduleRepo, () => [mismatched]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);

      await expect(repo.saveBulk([targetAssignment])).rejects.toThrow(/no longer matches/);

      expect(scheduleRepo.update).not.toHaveBeenCalled();
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'target_mismatch',
          retryCount: 0,
        }),
      );
    });

    it('emits conflict_unresolved when the single assignment write fails with 412', async () => {
      installRowEtag(scheduleRepo, () => [baseItem]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValue(new ScheduleConflictError());

      await expect(repo.saveBulk([targetAssignment])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'conflict',
          retryCount: 0,
        }),
      );
    });

    it('emits conflict_unresolved on a non-conflict error without retrying', async () => {
      installRowEtag(scheduleRepo, () => [baseItem]);
      vi.mocked(scheduleRepo.list).mockResolvedValueOnce([baseItem] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValueOnce(new Error('boom'));

      await expect(repo.saveBulk([targetAssignment])).rejects.toThrow('boom');

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'non_conflict_error',
          retryCount: 0,
        }),
      );
    });

    it('resolves the JST day, updates only that direction, and leaves the other day untouched', async () => {
      const toRow = {
        id: 'to-row',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: null,
        assignedStaffId: null,
        serviceType: 'transport',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '',
        etag: '"to"',
      };
      const fromRow = {
        id: 'from-row',
        title: '送り送迎',
        userId: 'U002',
        vehicleId: '車両9',
        assignedStaffId: 'S009',
        serviceType: 'transport',
        start: '2026-11-11T16:00:00+09:00',
        end: '2026-11-11T17:00:00+09:00',
        notes: '',
        etag: '"from"',
      };
      const nextDayRow = {
        id: 'next-day',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: null,
        assignedStaffId: null,
        serviceType: 'transport',
        start: '2026-11-12T08:30:00+09:00',
        end: '2026-11-12T09:00:00+09:00',
        notes: '',
        etag: '"next"',
      };
      bindLiveSchedule(scheduleRepo, [toRow, fromRow, nextDayRow]);

      await repo.saveBulk([{
        id: 'transport-2026-11-11-to-車両1',
        type: 'transport',
        start: '2026-11-11T08:00:00Z',
        end: '2026-11-11T10:00:00Z',
        title: '送迎: 車両1',
        status: 'planned',
        vehicleId: '車両1',
        driverId: 'S001',
        assistantStaffIds: [],
        userIds: ['U002'],
        direction: 'to',
      }]);

      expect(scheduleRepo.list).toHaveBeenCalledWith({
        range: {
          from: '2026-11-11T00:00:00+09:00',
          to: '2026-11-11T23:59:59+09:00',
        },
      });
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(vi.mocked(scheduleRepo.update).mock.calls[0][0]).toMatchObject({
        id: 'to-row',
        vehicleId: '車両1',
        assignedStaffId: 'S001',
      });
    });

    it('rejects when the intended user has no schedule row on that day and direction', async () => {
      vi.mocked(scheduleRepo.list).mockResolvedValue([] as never);

      await expect(repo.saveBulk([{
        ...targetAssignment,
        id: 'transport-2026-11-11-to-車両1',
        start: '2026-11-11T08:00:00Z',
        userIds: ['U002'],
        direction: 'to',
      }])).rejects.toThrow('[SharePointAssignmentRepository] No schedule row for 2026-11-11 to: U002');

      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('completes without update when the matched row already has the requested assignment', async () => {
      vi.mocked(scheduleRepo.list).mockResolvedValue([{
        ...baseItem,
        id: 'sched-same',
        userId: 'U002',
        vehicleId: '車両1',
        assignedStaffId: 'S001',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '',
      }] as never);

      await repo.saveBulk([{
        id: 'transport-2026-11-11-to-車両1',
        type: 'transport',
        start: '2026-11-11T08:00:00Z',
        end: '2026-11-11T10:00:00Z',
        title: '送迎: 車両1',
        status: 'planned',
        vehicleId: '車両1',
        driverId: 'S001',
        assistantStaffIds: [],
        userIds: ['U002'],
        direction: 'to',
      }]);

      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('rejects when assignment start is not a timestamp', async () => {
      await expect(repo.saveBulk([{
        ...targetAssignment,
        start: 'not-a-date',
      }])).rejects.toThrow('[SharePointAssignmentRepository] Cannot resolve JST date from assignment start: not-a-date');

      expect(scheduleRepo.list).not.toHaveBeenCalled();
      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('stops an unassign on 412 without a second write', async () => {
      const assignedRow = {
        id: 'u002-row',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: '車両1',
        assignedStaffId: 'S001',
        serviceType: 'transport',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '玄関前待機 [transport_attendant:S002]',
        etag: '"v1"',
      };
      installRowEtag(scheduleRepo, () => [assignedRow]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([assignedRow] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValue(new ScheduleConflictError());

      await expect(repo.saveBulk([{
        id: 'transport-2026-11-11-to-unassigned',
        type: 'transport',
        start: '2026-11-11T08:00:00Z',
        end: '2026-11-11T10:00:00Z',
        title: '送迎: 未割当',
        status: 'planned',
        assistantStaffIds: [],
        userIds: ['U002'],
        direction: 'to',
      }])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(scheduleRepo.update).mock.calls[0][0];
      expect(payload.etag).toBe('"v1"');
      expect(payload.vehicleId).toBe('');
      expect(payload.assignedStaffId).toBe('');
      expect(payload).not.toHaveProperty('startLocal');
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({ itemId: 'u002-row', reason: 'conflict', retryCount: 0 }),
      );
    });

    it('does not write when the authoritative row has no real ETag', async () => {
      installRowEtag(scheduleRepo, () => []);
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);

      await expect(repo.saveBulk([targetAssignment])).rejects.toThrow(/Real ETag is unavailable/);

      expect(scheduleRepo.update).not.toHaveBeenCalled();
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'etag_unavailable',
          retryCount: 0,
        }),
      );
    });

    it('does not refetch or rewrite after a 412', async () => {
      installRowEtag(scheduleRepo, () => [baseItem]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValueOnce(new ScheduleConflictError());

      await expect(repo.saveBulk([targetAssignment])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(scheduleRepo.list).toHaveBeenCalledTimes(2);
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'conflict',
          retryCount: 0,
        }),
      );
    });
  });

  describe('saveBulk: unassign', () => {
    const unassignU002: TransportAssignment = {
      id: 'transport-2026-11-11-to-unassigned',
      type: 'transport',
      start: '2026-11-11T08:00:00Z',
      end: '2026-11-11T10:00:00Z',
      title: '送迎: 未割当',
      status: 'planned',
      assistantStaffIds: [],
      userIds: ['U002'],
      direction: 'to',
    };

    let scheduleRepo: ScheduleRepository;
    let repo: SharePointAssignmentRepository;

    beforeEach(() => {
      scheduleRepo = {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      } as unknown as ScheduleRepository;
      repo = new SharePointAssignmentRepository(scheduleRepo);
      vi.mocked(scheduleRepo.update).mockImplementation(async (input) => input as never);
    });

    it('clears U002 vehicle, driver, and attendant while keeping free text and course', async () => {
      bindLiveSchedule(scheduleRepo, [{
        id: 'u002-row',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: '車両1',
        assignedStaffId: 'S001',
        serviceType: 'transport',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '玄関前待機 [transport_attendant:S002] [transport_course:isogo]',
        etag: '"u002"',
      }]);

      await repo.saveBulk([unassignU002]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(vi.mocked(scheduleRepo.update).mock.calls[0][0]).toMatchObject({
        id: 'u002-row',
        vehicleId: '',
        assignedStaffId: '',
        notes: '玄関前待機 [transport_course:isogo]',
      });
    });

    it('clears every unassigned user when the draft has no remaining riders', async () => {
      bindLiveSchedule(scheduleRepo, [
        {
          id: 'u001-row',
          title: '迎え送迎',
          userId: 'U001',
          vehicleId: '車両2',
          assignedStaffId: 'S003',
          serviceType: 'transport',
          start: '2026-11-11T08:40:00+09:00',
          end: '2026-11-11T09:10:00+09:00',
          notes: '[transport_attendant:S004]',
          etag: '"u001"',
        },
        {
          id: 'u002-row',
          title: '迎え送迎',
          userId: 'U002',
          vehicleId: '車両1',
          assignedStaffId: 'S001',
          serviceType: 'transport',
          start: '2026-11-11T08:30:00+09:00',
          end: '2026-11-11T09:00:00+09:00',
          notes: '',
          etag: '"u002"',
        },
      ]);

      await repo.saveBulk([{
        ...unassignU002,
        userIds: ['U001', 'U002'],
      }]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(2);
      const updatedIds = vi.mocked(scheduleRepo.update).mock.calls.map((call) => call[0].id).sort();
      expect(updatedIds).toEqual(['u001-row', 'u002-row']);
      for (const call of vi.mocked(scheduleRepo.update).mock.calls) {
        expect(call[0].vehicleId).toBe('');
        expect(call[0].assignedStaffId).toBe('');
      }
      const u001Notes = vi.mocked(scheduleRepo.update).mock.calls.find((call) => call[0].id === 'u001-row')?.[0].notes;
      expect(u001Notes).toBe('');
    });

    it('keeps U001 assigned while clearing only U002', async () => {
      bindLiveSchedule(scheduleRepo, [
        {
          id: 'u001-row',
          title: '迎え送迎',
          userId: 'U001',
          vehicleId: '車両2',
          assignedStaffId: 'S003',
          serviceType: 'transport',
          start: '2026-11-11T08:40:00+09:00',
          end: '2026-11-11T09:10:00+09:00',
          notes: '',
          etag: '"u001"',
        },
        {
          id: 'u002-row',
          title: '迎え送迎',
          userId: 'U002',
          vehicleId: '車両1',
          assignedStaffId: 'S001',
          serviceType: 'transport',
          start: '2026-11-11T08:30:00+09:00',
          end: '2026-11-11T09:00:00+09:00',
          notes: '[transport_attendant:S002]',
          etag: '"u002"',
        },
      ]);

      await repo.saveBulk([
        {
          id: 'transport-2026-11-11-to-車両2',
          type: 'transport',
          start: '2026-11-11T08:00:00Z',
          end: '2026-11-11T10:00:00Z',
          title: '送迎: 車両2',
          status: 'planned',
          vehicleId: '車両2',
          driverId: 'S003',
          assistantStaffIds: [],
          userIds: ['U001'],
          direction: 'to',
        },
        unassignU002,
      ]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(vi.mocked(scheduleRepo.update).mock.calls[0][0]).toMatchObject({
        id: 'u002-row',
        vehicleId: '',
        assignedStaffId: '',
        notes: '',
      });
    });

    it('does not clear the opposite direction or another date', async () => {
      bindLiveSchedule(scheduleRepo, [
        {
          id: 'to-row',
          title: '迎え送迎',
          userId: 'U002',
          vehicleId: '車両1',
          assignedStaffId: 'S001',
          serviceType: 'transport',
          start: '2026-11-11T08:30:00+09:00',
          end: '2026-11-11T09:00:00+09:00',
          notes: '',
          etag: '"to"',
        },
        {
          id: 'from-row',
          title: '送り送迎',
          userId: 'U002',
          vehicleId: '車両1',
          assignedStaffId: 'S001',
          serviceType: 'transport',
          start: '2026-11-11T16:00:00+09:00',
          end: '2026-11-11T17:00:00+09:00',
          notes: '',
          etag: '"from"',
        },
        {
          id: 'next-day',
          title: '迎え送迎',
          userId: 'U002',
          vehicleId: '車両1',
          assignedStaffId: 'S001',
          serviceType: 'transport',
          start: '2026-11-12T08:30:00+09:00',
          end: '2026-11-12T09:00:00+09:00',
          notes: '',
          etag: '"next"',
        },
      ]);

      await repo.saveBulk([unassignU002]);

      expect(scheduleRepo.list).toHaveBeenCalledWith({
        range: {
          from: '2026-11-11T00:00:00+09:00',
          to: '2026-11-11T23:59:59+09:00',
        },
      });
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(vi.mocked(scheduleRepo.update).mock.calls[0][0].id).toBe('to-row');
    });

    it('does not update a row that is already unassigned', async () => {
      vi.mocked(scheduleRepo.list).mockResolvedValue([{
        id: 'u002-row',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: null,
        assignedStaffId: null,
        serviceType: 'transport',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '玄関前待機',
        etag: '"clear"',
      }] as never);

      await repo.saveBulk([unassignU002]);

      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('rejects when the unassigned user has no schedule row', async () => {
      vi.mocked(scheduleRepo.list).mockResolvedValue([] as never);

      await expect(repo.saveBulk([unassignU002])).rejects.toThrow(
        '[SharePointAssignmentRepository] No schedule row for 2026-11-11 to: U002',
      );
      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('rejects when the unassign update fails', async () => {
      const row = {
        id: 'u002-row',
        title: '迎え送迎',
        userId: 'U002',
        vehicleId: '車両1',
        assignedStaffId: 'S001',
        serviceType: 'transport',
        start: '2026-11-11T08:30:00+09:00',
        end: '2026-11-11T09:00:00+09:00',
        notes: '',
        etag: '"u002"',
      };
      installRowEtag(scheduleRepo, () => [row]);
      vi.mocked(scheduleRepo.list).mockResolvedValue([row] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValueOnce(new Error('boom'));

      await expect(repo.saveBulk([unassignU002])).rejects.toThrow('boom');
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
    });
  });

  it('should filter by resourceId', async () => {
    const mockItems = [
      {
        id: '1',
        userId: 'user1',
        vehicleId: 'VehicleA',
        start: '2026-04-23T08:00:00Z',
        serviceType: 'transport',
      },
      {
        id: '2',
        userId: 'user2',
        vehicleId: 'VehicleB',
        start: '2026-04-23T08:00:00Z',
        serviceType: 'transport',
      }
    ];

    vi.mocked(mockScheduleRepo.list).mockResolvedValue(mockItems as never);

    const results = await repo.list({
      type: 'transport',
      range: { from: '2026-04-23T00:00:00Z', to: '2026-04-23T23:59:59Z' },
      resourceId: 'VehicleA'
    });

    expect(results).toHaveLength(1);
    expect((results[0] as TransportAssignment).vehicleId).toBe('VehicleA');
  });

  describe('saveBulk: partial save recovery', () => {
    const dayRow = (id: string, userId: string, start: string) => ({
      id,
      title: '迎え送迎',
      userId,
      vehicleId: '',
      assignedStaffId: '',
      serviceType: 'transport',
      start,
      end: start.replace('T08:30', 'T09:00'),
      notes: '',
      etag: '"8,1"',
    });
    const dayAssignment = (
      userId: string,
      start: string,
      direction: 'to' | 'from' = 'to',
    ): TransportAssignment => ({
      id: `transport-${userId}`,
      type: 'transport',
      start,
      end: '2026-11-11T10:00:00Z',
      title: '送迎',
      status: 'planned',
      vehicleId: '車両1',
      driverId: 'S001',
      assistantStaffIds: [],
      userIds: [userId],
      direction,
    });

    let scheduleRepo: ScheduleRepository;
    let repo: SharePointAssignmentRepository;

    beforeEach(() => {
      scheduleRepo = {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      } as unknown as ScheduleRepository;
      repo = new SharePointAssignmentRepository(scheduleRepo);
    });

    it('writes every validated group after the whole plan passes', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
        dayRow('u2', 'U002', '2026-11-12T08:30:00+09:00'),
      ]);

      await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-12T08:00:00Z'),
      ]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(2);
      expect(vi.mocked(scheduleRepo.update).mock.calls.map((call) => call[0].id).sort()).toEqual(['u1', 'u2']);
    });

    it('does not write when a later group fails validation', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
      ]);

      await expect(repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-12T08:00:00Z'),
      ])).rejects.toThrow('No schedule row for 2026-11-12 to: U002');

      expect(scheduleRepo.update).not.toHaveBeenCalled();
      expect(scheduleRepo.list).toHaveBeenCalledTimes(2);
    });

    it('confirms the first group and leaves the failed group unapplied', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
        dayRow('u2', 'U002', '2026-11-12T08:30:00+09:00'),
      ]);
      const liveUpdate = vi.mocked(scheduleRepo.update).getMockImplementation();
      vi.mocked(scheduleRepo.update).mockImplementation(async (input) => {
        if (input.id === 'u2') throw new Error('boom');
        return liveUpdate?.(input) as never;
      });

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-12T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('boom');
      expect(scheduleRepo.update).toHaveBeenCalledTimes(2);
      const report = readAssignmentSaveReport(error);
      expect(report?.reconciliation).toBe('complete');
      expect(report?.targets).toEqual(expect.arrayContaining([
        expect.objectContaining({ userId: 'U001', scheduleRowId: 'u1', outcome: 'CONFIRMED_APPLIED', writeStarted: true }),
        expect.objectContaining({ userId: 'U002', scheduleRowId: 'u2', outcome: 'CONFIRMED_NOT_APPLIED', writeStarted: true }),
      ]));
    });

    it('stops inside a group and does not write the remaining user', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
        dayRow('u2', 'U002', '2026-11-11T08:40:00+09:00'),
      ]);
      const liveUpdate = vi.mocked(scheduleRepo.update).getMockImplementation();
      vi.mocked(scheduleRepo.update).mockImplementation(async (input) => {
        if (input.id === 'u2') throw new Error('mid-group');
        return liveUpdate?.(input) as never;
      });

      const error = await repo.saveBulk([
        { ...dayAssignment('U001', '2026-11-11T08:00:00Z'), userIds: ['U001'] },
        { ...dayAssignment('U002', '2026-11-11T08:00:00Z'), userIds: ['U002'] },
      ]).catch((caught: unknown) => caught);

      expect(vi.mocked(scheduleRepo.update).mock.calls.map((call) => call[0].id)).toEqual(['u1', 'u2']);
      const report = readAssignmentSaveReport(error);
      expect(report?.targets).toEqual(expect.arrayContaining([
        expect.objectContaining({ userId: 'U001', outcome: 'CONFIRMED_APPLIED', writeStarted: true }),
        expect.objectContaining({ userId: 'U002', outcome: 'CONFIRMED_NOT_APPLIED', writeStarted: true }),
      ]));
    });

    it('keeps a sent write unresolved when the failed response is followed by the previous row', async () => {
      bindLiveSchedule(scheduleRepo, [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);
      vi.mocked(scheduleRepo.update).mockRejectedValue(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }));

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      const report = readAssignmentSaveReport(error);
      expect(report?.targets[0]).toMatchObject({
        outcome: 'CONFIRMED_NOT_APPLIED',
        conflict: false,
        writeStarted: true,
      });
      expect(report && nextUnresolvedAssignmentSave('req', report.targets, report)).not.toBeNull();
    });

    it('keeps a sent write unresolved when the failed response is followed by the intended row', async () => {
      const before = dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00');
      installRowEtag(scheduleRepo, () => [before]);
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([before] as never)
        .mockResolvedValueOnce([{ ...before, vehicleId: '車両1', assignedStaffId: 'S001', notes: '' }] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValue(new TypeError('Failed to fetch'));

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      const report = readAssignmentSaveReport(error);
      expect(report?.targets[0]).toMatchObject({
        outcome: 'CONFIRMED_APPLIED',
        conflict: false,
        writeStarted: true,
      });
      expect(report && nextUnresolvedAssignmentSave('req', report.targets, report)).not.toBeNull();
    });

    it('releases a validation failure only when no merge was sent', async () => {
      bindLiveSchedule(scheduleRepo, [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-12T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(scheduleRepo.update).not.toHaveBeenCalled();
      const report = readAssignmentSaveReport(error);
      expect(report?.targets.every((target) => target.outcome === 'NOT_ATTEMPTED' && target.writeStarted === false)).toBe(true);
      expect(report && nextUnresolvedAssignmentSave('req', report.targets, report)).toBeNull();
    });

    it('keeps a timed-out write unknown when reconciliation cannot read it back', async () => {
      installRowEtag(scheduleRepo, () => [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')] as never)
        .mockRejectedValueOnce(new Error('network timeout'));
      vi.mocked(scheduleRepo.update).mockRejectedValue(Object.assign(new Error('network timeout'), { name: 'TimeoutError' }));

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      const report = readAssignmentSaveReport(error);
      expect(report?.reconciliation).toBe('incomplete');
      expect(report?.targets[0]).toMatchObject({ outcome: 'UNKNOWN', writeStarted: true });
    });

    it('does not treat a successful response as applied when the refetch fails', async () => {
      installRowEtag(scheduleRepo, () => [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')] as never)
        .mockRejectedValueOnce(new Error('read failed'));
      vi.mocked(scheduleRepo.update).mockResolvedValue({} as never);

      const error = await repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
      ]).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ name: 'AssignmentPartialSaveError' });
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(readAssignmentSaveReport(error)?.targets[0]).toMatchObject({
        outcome: 'UNKNOWN',
        writeStarted: true,
      });
    });

    it('rejects conflicting targets for one rider before any write', async () => {
      bindLiveSchedule(scheduleRepo, [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);

      await expect(repo.saveBulk([
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        { ...dayAssignment('U001', '2026-11-11T08:00:00Z'), vehicleId: '車両2' },
      ])).rejects.toThrow('Conflicting assignment targets for 2026-11-11 to: U001');

      expect(scheduleRepo.update).not.toHaveBeenCalled();
      expect(scheduleRepo.list).not.toHaveBeenCalled();
    });

    it('writes only the unapplied row when the same save is repeated after a clean reconciliation', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
        dayRow('u2', 'U002', '2026-11-11T08:40:00+09:00'),
      ]);
      const liveUpdate = vi.mocked(scheduleRepo.update).getMockImplementation();
      vi.mocked(scheduleRepo.update).mockImplementation(async (input) => {
        if (input.id === 'u2') throw new Error('mid-group');
        return liveUpdate?.(input) as never;
      });
      const assignments = [
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-11T08:00:00Z'),
      ];

      const error = await repo.saveBulk(assignments).catch((caught: unknown) => caught);
      expect(readAssignmentSaveReport(error)?.reconciliation).toBe('complete');
      expect(readAssignmentSaveReport(error)?.targets).toEqual(expect.arrayContaining([
        expect.objectContaining({ userId: 'U001', outcome: 'CONFIRMED_APPLIED', conflict: false }),
        expect.objectContaining({ userId: 'U002', outcome: 'CONFIRMED_NOT_APPLIED', conflict: false }),
      ]));

      vi.mocked(scheduleRepo.update).mockClear();
      await repo.saveBulk(assignments).catch((caught: unknown) => caught);

      expect(vi.mocked(scheduleRepo.update).mock.calls.map((call) => call[0].id)).toEqual(['u2']);
    });

    it('previews and rereads an in-flight save without writing', async () => {
      bindLiveSchedule(scheduleRepo, [
        dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
        dayRow('u2', 'U002', '2026-11-12T08:30:00+09:00'),
      ]);
      const assignments = [
        dayAssignment('U001', '2026-11-11T08:00:00Z'),
        dayAssignment('U002', '2026-11-12T08:00:00Z'),
      ];
      const preview = await repo.previewTransportSave(assignments);
      expect(scheduleRepo.update).not.toHaveBeenCalled();
      expect(scheduleRepo.create).not.toHaveBeenCalled();
      expect(scheduleRepo.remove).not.toHaveBeenCalled();
      expect(preview.map((target) => target.scheduleRowId).sort()).toEqual(['u1', 'u2']);

      const record = {
        schemaVersion: 2 as const,
        requestId: 'flight',
        reconciliation: 'pending' as const,
        targets: preview.map((target) => ({
          dateKey: target.dateKey,
          direction: target.direction,
          userId: target.userId,
          scheduleRowId: target.scheduleRowId,
          outcome: 'IN_FLIGHT' as const,
          conflict: false,
          writeStarted: false,
          before: sealAssignmentFields(target.before),
          intent: sealAssignmentFields(target.intent),
        })),
      };
      const beforeRead = await repo.rereadUnresolvedSave(record);
      expect(beforeRead).not.toBeNull();
      expect(beforeRead?.targets[0]).toMatchObject({ outcome: 'UNKNOWN', conflict: true, reason: 'write_still_possible' });
      expect(scheduleRepo.update).not.toHaveBeenCalled();

      vi.mocked(scheduleRepo.list).mockResolvedValue([
        {
          ...dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
          vehicleId: preview[0].intent.vehicleId,
          assignedStaffId: preview[0].intent.driverId,
          notes: preview[0].intent.notes,
        },
        {
          ...dayRow('u2', 'U002', '2026-11-12T08:30:00+09:00'),
          vehicleId: preview[1].intent.vehicleId,
          assignedStaffId: preview[1].intent.driverId,
          notes: preview[1].intent.notes,
        },
      ] as never);
      const intentRead = await repo.rereadUnresolvedSave(record);
      expect(intentRead).not.toBeNull();
      expect(intentRead?.targets.every((target) => target.reason === 'write_still_possible')).toBe(true);
      expect(scheduleRepo.update).not.toHaveBeenCalled();

      vi.mocked(scheduleRepo.list).mockResolvedValue([
        {
          ...dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00'),
          vehicleId: preview[0].intent.vehicleId,
          assignedStaffId: 'OTHER',
          notes: preview[0].intent.notes,
        },
      ] as never);
      const conflicted = await repo.rereadUnresolvedSave({
        ...record,
        targets: [record.targets[0]],
      });
      expect(conflicted?.targets[0]).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'external_change' });
      expect(scheduleRepo.update).not.toHaveBeenCalled();

      vi.mocked(scheduleRepo.list).mockRejectedValue(new Error('get failed'));
      const unreadable = await repo.rereadUnresolvedSave({
        ...record,
        targets: [record.targets[0]],
      });
      expect(unreadable?.targets[0]).toMatchObject({ outcome: 'UNKNOWN', reason: 'reconcile_failed' });
      expect(scheduleRepo.update).not.toHaveBeenCalled();

      vi.mocked(scheduleRepo.list).mockResolvedValue([] as never);
      const missing = await repo.rereadUnresolvedSave({
        ...record,
        targets: [record.targets[0]],
      });
      expect(missing?.targets[0]).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'item_gone' });

      vi.mocked(scheduleRepo.list).mockResolvedValue([
        { ...dayRow('u1', 'U009', '2026-11-11T08:30:00+09:00') },
      ] as never);
      const mismatch = await repo.rereadUnresolvedSave({
        ...record,
        targets: [record.targets[0]],
      });
      expect(mismatch?.targets[0]).toMatchObject({ outcome: 'UNKNOWN', conflict: true, reason: 'target_mismatch' });
      expect(scheduleRepo.update).not.toHaveBeenCalled();
    });

    it('stops the 412 retry when the assignment save is aborted', async () => {
      bindLiveSchedule(scheduleRepo, [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);
      const controller = new AbortController();
      vi.mocked(scheduleRepo.update).mockImplementation(async (_input, params) => {
        expect(params?.signal).toBe(controller.signal);
        controller.abort();
        throw new ScheduleConflictError();
      });

      await expect(repo.saveBulk(
        [dayAssignment('U001', '2026-11-11T08:00:00Z')],
        { signal: controller.signal },
      )).rejects.toMatchObject({ name: 'AbortError' });
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
    });

    it('advances the real ETag with a same-value recovery merge and rejects the old ETag', async () => {
      const rows = [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')];
      vi.mocked(scheduleRepo.list).mockImplementation(async () => rows.map((row) => ({ ...row })) as never);
      vi.mocked(scheduleRepo.update).mockImplementation(async (input) => {
        const row = rows.find((item) => item.id === input.id);
        if (!row || row.etag !== input.etag) {
          throw Object.assign(new Error('412'), { status: 412 });
        }
        const version = Number(String(row.etag).replace(/"/g, '').split(',')[0]);
        row.etag = `"${version + 1},1"`;
        row.vehicleId = input.vehicleId ?? '';
        row.assignedStaffId = input.assignedStaffId ?? '';
        row.notes = input.notes ?? '';
        return { ...input, etag: row.etag } as never;
      });
      installRowEtag(scheduleRepo, () => rows as never);

      await repo.saveBulk([{
        ...dayAssignment('U001', '2026-11-11T08:00:00Z'),
        vehicleId: '',
        driverId: '',
      }], { recoveryTouchRowIds: ['u1', 'u2'] });

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(Object.keys(vi.mocked(scheduleRepo.update).mock.calls[0][0]).sort()).toEqual([
        'assignedStaffId', 'etag', 'id', 'notes', 'vehicleId',
      ]);
      expect(repo.consumeRecoveryMerges()).toEqual([
        { scheduleRowId: 'u1', beforeEtag: '"8,1"', afterEtag: '"9,1"' },
      ]);
      await expect(scheduleRepo.update({
        id: 'u1',
        etag: '"8,1"',
        vehicleId: '車両9',
        assignedStaffId: 'S009',
        notes: 'late',
      })).rejects.toMatchObject({ status: 412 });
      expect(rows[0]).toMatchObject({ etag: '"9,1"', vehicleId: '', notes: '' });
    });

    it('does not treat an unchanged ETag as recovery evidence', async () => {
      bindLiveSchedule(scheduleRepo, [dayRow('u1', 'U001', '2026-11-11T08:30:00+09:00')]);
      await repo.saveBulk([{
        ...dayAssignment('U001', '2026-11-11T08:00:00Z'),
        vehicleId: '',
        driverId: '',
      }], { recoveryTouchRowIds: ['u1'] });
      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(repo.consumeRecoveryMerges()).toEqual([]);
    });
  });
});
