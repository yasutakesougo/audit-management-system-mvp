import { describe, it, expect } from 'vitest';
import { mapVehicleDraftToDomain, evaluateDraftCoordination, buildPersistencePayloadsFromDomain } from '../assignmentAdapter';
import { TransportAssignmentDraft, TransportAssignmentScheduleRow } from '../../domain/transportAssignmentDraft';

describe('assignmentAdapter', () => {
  const mockDraft: TransportAssignmentDraft = {
    date: '2026-04-23',
    direction: 'to',
    users: [],
    vehicles: [
      {
        vehicleId: '車両1',
        courseId: null,
        courseLabel: null,
        driverStaffId: 'staff-a',
        driverName: 'Staff A',
        attendantStaffId: null,
        attendantName: null,
        riderUserIds: ['user-1', 'user-2', 'user-3'],
      },
      {
        vehicleId: '車両2',
        courseId: null,
        courseLabel: null,
        driverStaffId: 'staff-a', // Conflict: Same driver
        driverName: 'Staff A',
        attendantStaffId: null,
        attendantName: null,
        riderUserIds: ['user-4'],
      }
    ],
    unassignedUserIds: [],
  };

  it('should map vehicle draft to domain model correctly', () => {
    const domain = mapVehicleDraftToDomain(mockDraft.vehicles[0], mockDraft.date, mockDraft.direction);
    
    expect(domain.type).toBe('transport');
    expect(domain.vehicleId).toBe('車両1');
    expect(domain.driverId).toBe('staff-a');
    expect(domain.userIds).toHaveLength(3);
    expect(domain.direction).toBe('pickup'); // 'to' -> 'pickup'
  });

  it('should detect conflicts using domain logic via adapter', () => {
    const results = evaluateDraftCoordination(mockDraft);
    
    // Vehicle 1 should have a conflict with Vehicle 2 because of same driver
    const v1Result = results.find(r => r.vehicleId === '車両1');
    expect(v1Result?.conflicts).toHaveLength(1);
    expect(v1Result?.conflicts[0]).toContain('Driver conflict');
  });

  it('should detect capacity issues using domain logic via adapter', () => {
    const capacities = {
      '車両1': 2, // Only 2 allowed, but has 3 riders
    };
    const results = evaluateDraftCoordination(mockDraft, capacities);
    
    const v1Result = results.find(r => r.vehicleId === '車両1');
    expect(v1Result?.hasCapacityError).toBe(true);
    expect(v1Result?.overCapacityCount).toBe(1);
  });

  it('should generate persistence payloads from domain assignments', () => {
    const domainAssignments = [
      mapVehicleDraftToDomain(mockDraft.vehicles[0], mockDraft.date, mockDraft.direction)
    ];
    
    // Mock original schedules
    const mockSchedules: TransportAssignmentScheduleRow[] = [
      {
        id: 'row-1',
        etag: 'etag-1',
        start: '2026-04-23T08:00:00+09:00',
        end: '2026-04-23T09:00:00+09:00',
        userId: 'user-1',
        title: '送迎',
        category: 'User',
        status: 'Planned',
        visibility: 'org',
        vehicleId: 'old-vehicle', // Different from new vehicle
        notes: '',
      }
    ];

    const payloads = buildPersistencePayloadsFromDomain(
      domainAssignments,
      [],
      mockSchedules,
      '2026-04-23',
      'to'
    );

    expect(payloads).toHaveLength(1);
    expect(payloads[0].id).toBe('row-1');
    expect(payloads[0].vehicleId).toBe('車両1'); // Updated to new vehicle
  });
});
