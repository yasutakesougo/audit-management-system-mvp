import { describe, expect, it } from 'vitest';
import {
  evaluateMoveEvent,
  evaluateSelectEvent,
  getStatusIcon,
  getDynamicEventClasses,
  WORK_HOUR_LIMIT,
  type SimpleResourceEvent,
  type MoveWindow,
} from '../ircEventLogic';

// ── ヘルパー ───────────────────────────────────────────────────

const mkEvent = (overrides: Partial<SimpleResourceEvent> = {}): SimpleResourceEvent => ({
  id: 'evt-1',
  resourceId: 'staff-1',
  start: new Date('2026-03-15T09:00:00'),
  end: new Date('2026-03-15T12:00:00'),
  hasActual: false,
  ...overrides,
});

const mkWindow = (overrides: Partial<MoveWindow> = {}): MoveWindow => ({
  resourceId: 'staff-1',
  start: new Date('2026-03-15T13:00:00'),
  end: new Date('2026-03-15T16:00:00'),
  ...overrides,
});

// ── evaluateMoveEvent ──────────────────────────────────────────

describe('evaluateMoveEvent', () => {
  it('allows move when no conflicts', () => {
    const dragged = mkEvent();
    const window = mkWindow();
    const result = evaluateMoveEvent(window, dragged, [dragged]);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks move when event has actual (locked)', () => {
    const dragged = mkEvent({ hasActual: true });
    const window = mkWindow();
    const result = evaluateMoveEvent(window, dragged, [dragged]);
    expect(result).toEqual({ allowed: false, reason: 'locked' });
  });

  it('blocks move when overlapping with another event', () => {
    const dragged = mkEvent({ id: 'evt-1' });
    const existing = mkEvent({
      id: 'evt-2',
      start: new Date('2026-03-15T14:00:00'),
      end: new Date('2026-03-15T17:00:00'),
    });
    const window = mkWindow({
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const result = evaluateMoveEvent(window, dragged, [dragged, existing]);
    expect(result).toEqual({ allowed: false, reason: 'overlap' });
  });

  it('ignores overlap with the dragged event itself', () => {
    const dragged = mkEvent({ id: 'evt-1' });
    // Window overlaps with dragged's original position — should be OK (same ID)
    const window = mkWindow({
      start: new Date('2026-03-15T09:00:00'),
      end: new Date('2026-03-15T12:00:00'),
    });
    const result = evaluateMoveEvent(window, dragged, [dragged]);
    expect(result).toEqual({ allowed: true });
  });

  it('ignores background events in overlap check', () => {
    const dragged = mkEvent({ id: 'evt-1' });
    const bgEvent = mkEvent({
      id: 'evt-bg',
      display: 'background',
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const window = mkWindow();
    const result = evaluateMoveEvent(window, dragged, [dragged, bgEvent]);
    expect(result).toEqual({ allowed: true });
  });

  it('ignores events on different resources', () => {
    const dragged = mkEvent({ id: 'evt-1', resourceId: 'staff-1' });
    const otherResource = mkEvent({
      id: 'evt-3',
      resourceId: 'staff-2',
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const window = mkWindow({ resourceId: 'staff-1' });
    const result = evaluateMoveEvent(window, dragged, [dragged, otherResource]);
    expect(result).toEqual({ allowed: true });
  });

  it('locked takes priority over overlap', () => {
    const dragged = mkEvent({ hasActual: true });
    const existing = mkEvent({
      id: 'evt-2',
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const window = mkWindow();
    const result = evaluateMoveEvent(window, dragged, [dragged, existing]);
    // Even though there's overlap, locked should be the reason
    expect(result).toEqual({ allowed: false, reason: 'locked' });
  });
});

// ── evaluateSelectEvent ────────────────────────────────────────

describe('evaluateSelectEvent', () => {
  it('allows selection when no conflicts', () => {
    const window = mkWindow();
    const result = evaluateSelectEvent(window, []);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks selection when no resourceId', () => {
    const window = mkWindow({ resourceId: '' });
    const result = evaluateSelectEvent(window, []);
    expect(result).toEqual({ allowed: false, reason: 'no-resource' });
  });

  it('blocks selection when overlapping with existing event', () => {
    const existing = mkEvent({
      start: new Date('2026-03-15T14:00:00'),
      end: new Date('2026-03-15T17:00:00'),
    });
    const window = mkWindow({
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const result = evaluateSelectEvent(window, [existing]);
    expect(result).toEqual({ allowed: false, reason: 'overlap' });
  });

  it('allows selection when events do not overlap (adjacent)', () => {
    const existing = mkEvent({
      start: new Date('2026-03-15T09:00:00'),
      end: new Date('2026-03-15T12:00:00'),
    });
    const window = mkWindow({
      start: new Date('2026-03-15T12:00:00'),
      end: new Date('2026-03-15T15:00:00'),
    });
    const result = evaluateSelectEvent(window, [existing]);
    expect(result).toEqual({ allowed: true });
  });

  it('ignores background events', () => {
    const bgEvent = mkEvent({
      display: 'background',
      start: new Date('2026-03-15T13:00:00'),
      end: new Date('2026-03-15T16:00:00'),
    });
    const window = mkWindow();
    const result = evaluateSelectEvent(window, [bgEvent]);
    expect(result).toEqual({ allowed: true });
  });
});

// ── getStatusIcon ──────────────────────────────────────────────

describe('getStatusIcon', () => {
  it.each([
    ['waiting', '⏳'],
    ['in-progress', '🔄'],
    ['completed', '✅'],
    ['delayed', '⚠️'],
    ['cancelled', '❌'],
  ] as const)('returns %s → %s', (status, icon) => {
    expect(getStatusIcon(status)).toBe(icon);
  });

  it('returns 📅 for undefined', () => {
    expect(getStatusIcon(undefined)).toBe('📅');
  });
});

// ── getDynamicEventClasses ─────────────────────────────────────

describe('getDynamicEventClasses', () => {
  it('always includes unified-event', () => {
    const classes = getDynamicEventClasses({
      event: { extendedProps: {} },
    });
    expect(classes).toContain('unified-event');
  });

  it('adds planType class', () => {
    const classes = getDynamicEventClasses({
      event: { extendedProps: { planType: 'visit' } },
    });
    expect(classes).toContain('event-type-visit');
  });

  it('adds status class', () => {
    const classes = getDynamicEventClasses({
      event: { extendedProps: { status: 'completed' } },
    });
    expect(classes).toContain('event-status-completed');
  });

  it('adds both planType and status classes', () => {
    const classes = getDynamicEventClasses({
      event: { extendedProps: { planType: 'center', status: 'delayed' } },
    });
    expect(classes).toEqual(expect.arrayContaining([
      'unified-event',
      'event-type-center',
      'event-status-delayed',
    ]));
  });

  it('handles missing props gracefully', () => {
    const classes = getDynamicEventClasses({
      event: { extendedProps: {} },
    });
    expect(classes).toEqual(['unified-event']);
  });
});

// ── WORK_HOUR_LIMIT ────────────────────────────────────────────

describe('WORK_HOUR_LIMIT', () => {
  it('is 8 hours', () => {
    expect(WORK_HOUR_LIMIT).toBe(8);
  });
});
