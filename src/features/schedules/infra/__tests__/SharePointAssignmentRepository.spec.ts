import { describe, it, expect, vi } from 'vitest';
import { SharePointAssignmentRepository } from '../SharePointAssignmentRepository';
import type { ScheduleRepository } from '../../domain/ScheduleRepository';
import type { TransportAssignment } from '../../domain/assignment';

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

    (mockScheduleRepo.list as any).mockResolvedValue(mockItems);

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

    (mockScheduleRepo.list as any).mockResolvedValue(mockItems);

    const results = await repo.list({ 
      type: 'transport', 
      range: { from: '2026-04-23T00:00:00Z', to: '2026-04-23T23:59:59Z' },
      resourceId: 'VehicleA'
    });

    expect(results).toHaveLength(1);
    expect((results[0] as TransportAssignment).vehicleId).toBe('VehicleA');
  });
});
