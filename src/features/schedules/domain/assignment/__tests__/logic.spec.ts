import { describe, it, expect } from 'vitest';
import { hasTimeConflict, detectTransportConflicts, checkCapacity } from '../logic';
import { TransportAssignment, BaseAssignment } from '../types';

describe('Assignment Domain Logic', () => {
  describe('hasTimeConflict', () => {
    it('should detect overlapping assignments', () => {
      const a = { start: '2026-04-23T09:00:00', end: '2026-04-23T10:00:00' } as BaseAssignment;
      const b = { start: '2026-04-23T09:30:00', end: '2026-04-23T10:30:00' } as BaseAssignment;
      expect(hasTimeConflict(a, b)).toBe(true);
    });

    it('should return false for back-to-back assignments', () => {
      const a = { start: '2026-04-23T09:00:00', end: '2026-04-23T10:00:00' } as BaseAssignment;
      const b = { start: '2026-04-23T10:00:00', end: '2026-04-23T11:00:00' } as BaseAssignment;
      expect(hasTimeConflict(a, b)).toBe(false);
    });
  });

  describe('detectTransportConflicts', () => {
    const baseAssignment: TransportAssignment = {
      id: '1',
      type: 'transport',
      title: 'Pickup A',
      start: '2026-04-23T08:00:00',
      end: '2026-04-23T09:00:00',
      status: 'planned',
      direction: 'to',
      userIds: ['u1'],
      assistantStaffIds: [],
    };

    it('should detect vehicle conflict', () => {
      const a = { ...baseAssignment, vehicleId: 'V1' };
      const b = { ...baseAssignment, id: '2', vehicleId: 'V1', start: '2026-04-23T08:30:00', end: '2026-04-23T09:30:00' };
      
      const result = detectTransportConflicts(a, b);
      expect(result.conflict).toBe(true);
      expect(result.reasons[0]).toContain('Vehicle conflict');
    });

    it('should detect driver conflict', () => {
      const a = { ...baseAssignment, driverId: 'S1' };
      const b = { ...baseAssignment, id: '2', driverId: 'S1', start: '2026-04-23T08:30:00', end: '2026-04-23T09:30:00' };
      
      const result = detectTransportConflicts(a, b);
      expect(result.conflict).toBe(true);
      expect(result.reasons[0]).toContain('Driver conflict');
    });

    it('should not detect conflict if times do not overlap', () => {
      const a = { ...baseAssignment, vehicleId: 'V1', driverId: 'S1' };
      const b = { ...baseAssignment, id: '2', vehicleId: 'V1', driverId: 'S1', start: '2026-04-23T10:00:00', end: '2026-04-23T11:00:00' };
      
      const result = detectTransportConflicts(a, b);
      expect(result.conflict).toBe(false);
    });
  });

  describe('checkCapacity', () => {
    const assignment: TransportAssignment = {
      id: '1',
      type: 'transport',
      title: 'Route A',
      start: '2026-04-23T08:00:00',
      end: '2026-04-23T09:00:00',
      status: 'planned',
      direction: 'to',
      userIds: ['u1', 'u2', 'u3'],
      assistantStaffIds: [],
    };

    it('should return valid if within capacity', () => {
      const result = checkCapacity(assignment, 5);
      expect(result.valid).toBe(true);
      expect(result.over).toBe(0);
    });

    it('should return invalid and over count if exceeding capacity', () => {
      const result = checkCapacity(assignment, 2);
      expect(result.valid).toBe(false);
      expect(result.over).toBe(1);
    });
  });
});
