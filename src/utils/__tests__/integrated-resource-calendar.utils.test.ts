import { describe, expect, it } from 'vitest';
import {
    calculateTotalsByResource,
    checkEventDropAllowed,
    checkSelectAllowed,
    eventApiToTestable,
    generateWarningEvents,
    type EventDropInfo,
    type ResourceWarning,
    type TestableEvent,
} from '../integrated-resource-calendar.utils';

// テスト用のモックイベント作成ヘルパー
const createMockEvent = (
  id: string,
  start: Date,
  end: Date,
  resourceId: string,
  extendedProps: Record<string, unknown> = {}
): TestableEvent => ({
  id,
  start,
  end,
  extendedProps,
  getResources: () => [{ id: resourceId }],
});

describe('integrated-resource-calendar.utils', () => {
  describe('checkEventDropAllowed', () => {
    const baseEvent = createMockEvent(
      'event-1',
      new Date('2025-01-15T09:00:00'),
      new Date('2025-01-15T10:00:00'),
      'staff-1'
    );

    it('should reject invalid time range (start >= end)', () => {
      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T10:00:00'),
        end: new Date('2025-01-15T09:00:00'), // Invalid: end before start
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(baseEvent, dropInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('開始時刻は終了時刻より前である必要があります。');
    });

    it('should reject drop for event with actualStart', () => {
      const eventWithActual = createMockEvent(
        'event-1',
        new Date('2025-01-15T09:00:00'),
        new Date('2025-01-15T10:00:00'),
        'staff-1',
        { actualStart: '2025-01-15T09:00:00Z' }
      );

      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T11:00:00'),
        end: new Date('2025-01-15T12:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(eventWithActual, dropInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('実績が登録されている予定は編集できません。');
    });

    it('should reject overlapping events on same resource', () => {
      const existingEvent = createMockEvent(
        'event-2',
        new Date('2025-01-15T10:30:00'),
        new Date('2025-01-15T11:30:00'),
        'staff-1'
      );

      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T11:00:00'), // Overlaps with existing
        end: new Date('2025-01-15T12:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(baseEvent, dropInfo, [existingEvent]);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('同じスタッフの同じ時間帯に重複する予定は登録できません。');
    });

    it('should allow valid non-overlapping drop', () => {
      const existingEvent = createMockEvent(
        'event-2',
        new Date('2025-01-15T08:00:00'),
        new Date('2025-01-15T09:00:00'),
        'staff-1'
      );

      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T11:00:00'),
        end: new Date('2025-01-15T12:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(baseEvent, dropInfo, [existingEvent]);

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should allow boundary touching events (end === start)', () => {
      const existingEvent = createMockEvent(
        'event-2',
        new Date('2025-01-15T08:00:00'),
        new Date('2025-01-15T09:00:00'),
        'staff-1'
      );

      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T09:00:00'), // Exactly at end of existing
        end: new Date('2025-01-15T10:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(baseEvent, dropInfo, [existingEvent]);

      expect(result.allowed).toBe(true);
    });

    it('should ignore background events for overlap check', () => {
      const backgroundEvent: TestableEvent = {
        ...createMockEvent('bg-1', new Date('2025-01-15T10:00:00'), new Date('2025-01-15T12:00:00'), 'staff-1'),
        display: 'background'
      };

      const dropInfo: EventDropInfo = {
        start: new Date('2025-01-15T11:00:00'),
        end: new Date('2025-01-15T12:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkEventDropAllowed(baseEvent, dropInfo, [backgroundEvent]);

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkSelectAllowed', () => {
    it('should reject invalid time range', () => {
      const selectInfo: EventDropInfo = {
        start: new Date('2025-01-15T10:00:00'),
        end: new Date('2025-01-15T09:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkSelectAllowed(selectInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('開始時刻は終了時刻より前である必要があります。');
    });

    it('should reject selection without resourceId', () => {
      const selectInfo: EventDropInfo = {
        start: new Date('2025-01-15T09:00:00'),
        end: new Date('2025-01-15T10:00:00'),
        // resourceId: undefined
      };

      const result = checkSelectAllowed(selectInfo, []);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('リソース行上でのみ予定を作成できます。');
    });

    it('should reject overlapping selection', () => {
      const existingEvent = createMockEvent(
        'event-1',
        new Date('2025-01-15T09:30:00'),
        new Date('2025-01-15T10:30:00'),
        'staff-1'
      );

      const selectInfo: EventDropInfo = {
        start: new Date('2025-01-15T10:00:00'),
        end: new Date('2025-01-15T11:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkSelectAllowed(selectInfo, [existingEvent]);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('すでに予定が入っている時間帯には新しい予定を作成できません。');
    });

    it('should allow valid selection', () => {
      const existingEvent = createMockEvent(
        'event-1',
        new Date('2025-01-15T08:00:00'),
        new Date('2025-01-15T09:00:00'),
        'staff-1'
      );

      const selectInfo: EventDropInfo = {
        start: new Date('2025-01-15T10:00:00'),
        end: new Date('2025-01-15T11:00:00'),
        resourceId: 'staff-1'
      };

      const result = checkSelectAllowed(selectInfo, [existingEvent]);

      expect(result.allowed).toBe(true);
    });
  });

  describe('calculateTotalsByResource', () => {
    it('should calculate basic totals correctly', () => {
      const events: TestableEvent[] = [
        createMockEvent('e1', new Date('2025-01-15T09:00:00'), new Date('2025-01-15T11:00:00'), 'staff-1'), // 2h
        createMockEvent('e2', new Date('2025-01-15T14:00:00'), new Date('2025-01-15T18:30:00'), 'staff-1'), // 4.5h
        createMockEvent('e3', new Date('2025-01-15T10:00:00'), new Date('2025-01-15T13:00:00'), 'staff-2'), // 3h
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1']).toEqual({
        totalHours: 6.5,
        isOver: false
      });
      expect(result['staff-2']).toEqual({
        totalHours: 3.0,
        isOver: false
      });
    });

    it('should detect over-limit resources', () => {
      const events: TestableEvent[] = [
        createMockEvent('e1', new Date('2025-01-15T09:00:00'), new Date('2025-01-15T18:00:00'), 'staff-1'), // 9h
      ];

      const result = calculateTotalsByResource(events, 8); // 8h limit

      expect(result['staff-1']).toEqual({
        totalHours: 9.0,
        isOver: true
      });
    });

    it('should ignore background events', () => {
      const events: TestableEvent[] = [
        createMockEvent('e1', new Date('2025-01-15T09:00:00'), new Date('2025-01-15T11:00:00'), 'staff-1'),
        { ...createMockEvent('bg1', new Date('2025-01-15T12:00:00'), new Date('2025-01-15T18:00:00'), 'staff-1'), display: 'background' }
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1']).toEqual({
        totalHours: 2.0,
        isOver: false
      });
    });

    it('should handle negative duration events safely', () => {
      const events: TestableEvent[] = [
        createMockEvent('e1', new Date('2025-01-15T11:00:00'), new Date('2025-01-15T09:00:00'), 'staff-1'), // Invalid: end < start
        createMockEvent('e2', new Date('2025-01-15T14:00:00'), new Date('2025-01-15T16:00:00'), 'staff-1'), // Valid: 2h
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1']).toEqual({
        totalHours: 2.0, // Only counts valid event
        isOver: false
      });
    });

    it('should round to 1 decimal place correctly', () => {
      const events: TestableEvent[] = [
        createMockEvent('e1', new Date('2025-01-15T09:00:00'), new Date('2025-01-15T10:25:00'), 'staff-1'), // 1.41666...h → 1.4h
      ];

      const result = calculateTotalsByResource(events);

      expect(result['staff-1'].totalHours).toBe(1.4);
    });
  });

  describe('generateWarningEvents', () => {
    it('should generate warning events for over-limit resources', () => {
      const resourceWarnings: Record<string, ResourceWarning> = {
        'staff-1': { totalHours: 9.5, isOver: true },
        'staff-2': { totalHours: 6.0, isOver: false },
        'staff-3': { totalHours: 10.2, isOver: true },
      };

      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-15');

      const result = generateWarningEvents(resourceWarnings, startDate, endDate);

      expect(result).toHaveLength(2); // Only staff-1 and staff-3

      // Check structure without exact date string comparison
      expect(result[0]).toMatchObject({
        id: expect.stringMatching(/^warning-staff-1-/),
        title: '⚠️ 過負荷警告 (9.5h)',
        resourceId: 'staff-1',
        display: 'background',
        backgroundColor: 'rgba(255, 0, 0, 0.15)',
        classNames: ['fc-event-warning-bg'],
        extendedProps: {
          planId: 'warning-staff-1',
          planType: 'admin',
          planDescription: 'リソース過負荷警告: 9.5時間',
          status: 'waiting',
        },
      });

      expect(result[1]).toMatchObject({
        resourceId: 'staff-3',
        title: '⚠️ 過負荷警告 (10.2h)',
      });
    });

    it('should not generate warnings for non-over resources', () => {
      const resourceWarnings: Record<string, ResourceWarning> = {
        'staff-1': { totalHours: 7.5, isOver: false },
        'staff-2': { totalHours: 8.0, isOver: false },
      };

      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-15');

      const result = generateWarningEvents(resourceWarnings, startDate, endDate);

      expect(result).toHaveLength(0);
    });
  });

  describe('eventApiToTestable', () => {
    it('should convert EventApi to TestableEvent correctly', () => {
      // Mock FullCalendar EventApi
      const mockEventApi = {
        id: 'test-event',
        start: new Date('2025-01-15T09:00:00'),
        end: new Date('2025-01-15T10:00:00'),
        display: undefined,
        extendedProps: { actualStart: '2025-01-15T09:05:00Z', resourceId: 'staff-1' },
        getResources: () => [{ id: 'staff-1' }],
      } as const;

      const result = eventApiToTestable(mockEventApi as never);

      expect(result).toEqual({
        id: 'test-event',
        start: mockEventApi.start,
        end: mockEventApi.end,
        display: undefined,
        extendedProps: mockEventApi.extendedProps,
        getResources: expect.any(Function),
      });

      // Test that getResources function works
      expect(result.getResources()).toEqual([{ id: 'staff-1' }]);
    });
  });
});