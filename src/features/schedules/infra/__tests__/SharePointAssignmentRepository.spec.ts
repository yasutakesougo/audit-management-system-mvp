import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointAssignmentRepository } from '../SharePointAssignmentRepository';
import { ScheduleConflictError, type ScheduleRepository } from '../../domain/ScheduleRepository';
import type { TransportAssignment } from '../../domain/assignment';
import { emitTelemetry } from '@/lib/telemetry';

vi.mock('@/lib/telemetry', () => ({
  emitTelemetry: vi.fn(),
}));

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
      vi.mocked(scheduleRepo.list).mockResolvedValue([baseItem] as never);
      vi.mocked(scheduleRepo.update).mockResolvedValue(baseItem as never);

      await repo.saveBulk([targetAssignment]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(emitTelemetry).not.toHaveBeenCalled();
    });

    it('refetches, merges, and retries once on 412 — emits conflict_resolved', async () => {
      const freshItem = { ...baseItem, etag: '"v2"', notes: 'touched-by-other-user' };
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([baseItem] as never)   // initial fetch
        .mockResolvedValueOnce([freshItem] as never); // refetch after 412
      vi.mocked(scheduleRepo.update)
        .mockRejectedValueOnce(new ScheduleConflictError())
        .mockResolvedValueOnce(freshItem as never);

      await repo.saveBulk([targetAssignment]);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(2);

      // The retry payload must carry the refetched etag and the caller's intended fields.
      const retryPayload = vi.mocked(scheduleRepo.update).mock.calls[1][0];
      expect(retryPayload.etag).toBe('"v2"');
      expect(retryPayload.assignedStaffId).toBe('staffNew');

      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_resolved',
        expect.objectContaining({ itemId: 'sched-1', retryCount: 1 }),
      );
    });

    it('emits conflict_unresolved when retry also fails with 412', async () => {
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([baseItem] as never)
        .mockResolvedValueOnce([{ ...baseItem, etag: '"v2"' }] as never);
      vi.mocked(scheduleRepo.update)
        .mockRejectedValueOnce(new ScheduleConflictError())
        .mockRejectedValueOnce(new ScheduleConflictError());

      await expect(repo.saveBulk([targetAssignment])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'retry_exhausted',
          retryCount: 1,
        }),
      );
    });

    it('emits conflict_unresolved on a non-conflict error without retrying', async () => {
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

    it('emits conflict_unresolved with reason=item_gone if the row vanished on refetch', async () => {
      vi.mocked(scheduleRepo.list)
        .mockResolvedValueOnce([baseItem] as never)
        .mockResolvedValueOnce([] as never);
      vi.mocked(scheduleRepo.update).mockRejectedValueOnce(new ScheduleConflictError());

      await expect(repo.saveBulk([targetAssignment])).rejects.toBeInstanceOf(ScheduleConflictError);

      expect(scheduleRepo.update).toHaveBeenCalledTimes(1);
      expect(emitTelemetry).toHaveBeenCalledWith(
        'assignment:conflict_unresolved',
        expect.objectContaining({
          itemId: 'sched-1',
          reason: 'item_gone',
          retryCount: 1,
        }),
      );
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
});
