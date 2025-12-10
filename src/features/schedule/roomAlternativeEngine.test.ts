import { describe, expect, it } from 'vitest';
import {
    generateDemoEquipmentProfiles,
    generateDemoRoomProfiles,
    suggestEquipmentAlternatives,
    suggestRoomAlternatives,
    type EquipmentAlternativeRequest,
    type RoomAlternativeRequest
} from './roomAlternativeEngine';

describe('Stage 8: Room & Equipment Alternative Engine', () => {
  describe('Demo Data Generation', () => {
    it('should generate demo rooms with proper structure', () => {
      const demoRooms = generateDemoRoomProfiles();
      expect(demoRooms).toHaveLength(4); // Actual length from implementation
      expect(demoRooms[0]).toHaveProperty('id');
      expect(demoRooms[0]).toHaveProperty('name');
      expect(demoRooms[0]).toHaveProperty('capacity');
      expect(demoRooms[0]).toHaveProperty('fixedEquipment');
      expect(demoRooms[0]).toHaveProperty('accessibility');
    });

    it('should generate demo equipment with proper structure', () => {
      const demoEquipment = generateDemoEquipmentProfiles();
      expect(demoEquipment).toHaveLength(5); // Actual length from implementation
      expect(demoEquipment[0]).toHaveProperty('id');
      expect(demoEquipment[0]).toHaveProperty('name');
      expect(demoEquipment[0]).toHaveProperty('type');
      expect(demoEquipment[0]).toHaveProperty('availableUnits');
      expect(demoEquipment[0]).toHaveProperty('requiredSkills');
    });
  });

  describe('Room Alternative Suggestions', () => {
    it('should suggest room alternatives based on requirements', () => {
      const demoRooms = generateDemoRoomProfiles();
      const mockSchedules = [
        { start: '2024-01-10T09:00:00Z', end: '2024-01-10T10:00:00Z', id: 'existing-1' }
      ];

      const request: RoomAlternativeRequest = {
        targetSchedule: { start: '2024-01-10T14:00:00Z', end: '2024-01-10T15:00:00Z', id: 'new-schedule' },
        requiredCapacity: 5,
        requiredEquipment: ['プロジェクター'],
        maxSuggestions: 3
      };

      const alternatives = suggestRoomAlternatives(request, demoRooms, mockSchedules);
      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(3);

      if (alternatives.length > 0) {
        expect(alternatives[0]).toHaveProperty('roomId');
        expect(alternatives[0]).toHaveProperty('roomName');
        expect(alternatives[0]).toHaveProperty('priority');
        expect(alternatives[0]).toHaveProperty('reason');
        expect(alternatives[0]).toHaveProperty('capacitySuitability');
      }
    });
  });

  describe('Equipment Alternative Suggestions', () => {
    it('should suggest equipment alternatives based on requirements', () => {
      const demoEquipment = generateDemoEquipmentProfiles();
      const mockSchedules = [
        { start: '2024-01-10T09:00:00Z', end: '2024-01-10T10:00:00Z', id: 'existing-1' }
      ];

      const request: EquipmentAlternativeRequest = {
        targetSchedule: { start: '2024-01-10T14:00:00Z', end: '2024-01-10T15:00:00Z', id: 'new-schedule' },
        requiredEquipmentTypes: ['medical'],
        requiredUnits: 1,
        maxSuggestions: 3
      };

      const alternatives = suggestEquipmentAlternatives(request, demoEquipment, mockSchedules);
      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(3);

      if (alternatives.length > 0) {
        expect(alternatives[0]).toHaveProperty('equipmentId');
        expect(alternatives[0]).toHaveProperty('equipmentName');
        expect(alternatives[0]).toHaveProperty('availableUnits');
        expect(alternatives[0]).toHaveProperty('reason');
        expect(alternatives[0]).toHaveProperty('priority');
      }
    });
  });

  describe('Integration Testing', () => {
    it('should provide different alternatives for different request types', () => {
      const demoRooms = generateDemoRoomProfiles();
      const demoEquipment = generateDemoEquipmentProfiles();
      const mockSchedules = [
        { start: '2024-01-10T09:00:00Z', end: '2024-01-10T10:00:00Z', id: 'existing-1' }
      ];

      const roomRequest: RoomAlternativeRequest = {
        targetSchedule: { start: '2024-01-10T14:00:00Z', end: '2024-01-10T15:00:00Z', id: 'schedule-1' },
        requiredCapacity: 3
      };

      const equipmentRequest: EquipmentAlternativeRequest = {
        targetSchedule: { start: '2024-01-10T14:00:00Z', end: '2024-01-10T15:00:00Z', id: 'schedule-1' },
        requiredUnits: 1
      };

      const roomAlts = suggestRoomAlternatives(roomRequest, demoRooms, mockSchedules);
      const equipmentAlts = suggestEquipmentAlternatives(equipmentRequest, demoEquipment, mockSchedules);

      expect(roomAlts).not.toEqual(equipmentAlts);
      expect(roomAlts[0]).toHaveProperty('roomId');
      expect(equipmentAlts[0]).toHaveProperty('equipmentId');
    });
  });
});