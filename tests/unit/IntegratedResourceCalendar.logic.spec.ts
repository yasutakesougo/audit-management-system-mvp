import {
    evaluateMoveEvent,
    evaluateSelectEvent,
    type SimpleResourceEvent,
} from '@/pages/IntegratedResourceCalendarPage';
import { describe, expect, it } from 'vitest';

const mkEvent = (partial: Partial<SimpleResourceEvent> = {}): SimpleResourceEvent => ({
  id: 'e1',
  resourceId: 'staff-1',
  start: new Date('2025-11-16T09:00:00+09:00'),
  end: new Date('2025-11-16T10:00:00+09:00'),
  display: undefined,
  hasActual: false,
  ...partial,
});

describe('IntegratedResourceCalendar logic helpers', () => {
  describe('evaluateMoveEvent', () => {
    it('allows move when no actual and no overlap', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T10:00:00+09:00'),
        end: new Date('2025-11-16T11:00:00+09:00'),
      };

      const dragged = mkEvent({ id: 'drag', start: window.start, end: window.end });
      const allEvents: SimpleResourceEvent[] = [
        mkEvent({
          id: 'other',
          start: new Date('2025-11-16T08:00:00+09:00'),
          end: new Date('2025-11-16T09:00:00+09:00'),
        }),
      ];

      const result = evaluateMoveEvent(window, dragged, allEvents);
      expect(result.allowed).toBe(true);
    });

    it('blocks move when dragged event already has actual', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T10:00:00+09:00'),
        end: new Date('2025-11-16T11:00:00+09:00'),
      };

      const dragged = mkEvent({
        id: 'drag',
        hasActual: true,
        start: window.start,
        end: window.end,
      });

      const result = evaluateMoveEvent(window, dragged, []);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('locked');
      }
    });

    it('blocks move when overlapping another event on same resource', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T09:30:00+09:00'),
        end: new Date('2025-11-16T10:30:00+09:00'),
      };

      const dragged = mkEvent({ id: 'drag', start: window.start, end: window.end });
      const allEvents: SimpleResourceEvent[] = [
        mkEvent({
          id: 'other',
          start: new Date('2025-11-16T09:00:00+09:00'),
          end: new Date('2025-11-16T10:00:00+09:00'),
        }),
      ];

      const result = evaluateMoveEvent(window, dragged, allEvents);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('overlap');
      }
    });

    it('ignores background events when checking overlap', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T09:30:00+09:00'),
        end: new Date('2025-11-16T10:30:00+09:00'),
      };

      const dragged = mkEvent({ id: 'drag', start: window.start, end: window.end });
      const allEvents: SimpleResourceEvent[] = [
        mkEvent({
          id: 'warn',
          display: 'background',
          start: new Date('2025-11-16T09:00:00+09:00'),
          end: new Date('2025-11-16T11:00:00+09:00'),
        }),
      ];

      const result = evaluateMoveEvent(window, dragged, allEvents);
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluateSelectEvent', () => {
    it('blocks selection with no resourceId', () => {
      const window = {
        resourceId: '',
        start: new Date('2025-11-16T09:00:00+09:00'),
        end: new Date('2025-11-16T10:00:00+09:00'),
      };

      const result = evaluateSelectEvent(window, []);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('no-resource');
      }
    });

    it('blocks selection when overlapping existing event on same resource', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T09:30:00+09:00'),
        end: new Date('2025-11-16T10:30:00+09:00'),
      };

      const allEvents: SimpleResourceEvent[] = [
        mkEvent({
          id: 'existing',
          start: new Date('2025-11-16T09:00:00+09:00'),
          end: new Date('2025-11-16T10:00:00+09:00'),
        }),
      ];

      const result = evaluateSelectEvent(window, allEvents);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('overlap');
      }
    });

    it('allows selection when there is no overlap on same resource', () => {
      const window = {
        resourceId: 'staff-1',
        start: new Date('2025-11-16T11:00:00+09:00'),
        end: new Date('2025-11-16T12:00:00+09:00'),
      };

      const allEvents: SimpleResourceEvent[] = [
        mkEvent({
          id: 'existing',
          start: new Date('2025-11-16T09:00:00+09:00'),
          end: new Date('2025-11-16T10:00:00+09:00'),
        }),
      ];

      const result = evaluateSelectEvent(window, allEvents);
      expect(result.allowed).toBe(true);
    });
  });
});
