/**
 * scheduleNextGap.spec.ts
 *
 * Phase 7-C: 連続入力ナビゲーションのテスト
 */
import { describe, expect, it } from 'vitest';

import type { ScheduleItemForTemplate } from '../../builders/scheduleQuickTemplates';
import { countRemainingGaps, findNextGap } from '../scheduleNextGap';

// ── Fixtures ──────────────────────────────────────────────────────────────

const DATE = '2026-03-20';

const makeItem = (startHhmm: string, endHhmm: string): ScheduleItemForTemplate => ({
  category: 'User',
  serviceType: 'normal',
  start: `${DATE}T${startHhmm}:00`,
  end: `${DATE}T${endHhmm}:00`,
  userId: 'user-1',
});

// ── findNextGap ───────────────────────────────────────────────────────────

describe('findNextGap', () => {
  it('returns first slot (06:00-07:00) when no items exist', () => {
    const result = findNextGap([], DATE);
    expect(result).toEqual({
      startTime: '06:00',
      endTime: '07:00',
      date: DATE,
    });
  });

  it('skips occupied first slot and returns second', () => {
    const items = [makeItem('06:00', '07:00')];
    const result = findNextGap(items, DATE);
    expect(result).toEqual({
      startTime: '07:00',
      endTime: '08:00',
      date: DATE,
    });
  });

  it('skips multiple occupied slots', () => {
    const items = [
      makeItem('06:00', '07:00'),
      makeItem('07:00', '08:00'),
      makeItem('08:00', '09:00'),
    ];
    const result = findNextGap(items, DATE);
    expect(result).toEqual({
      startTime: '09:00',
      endTime: '10:00',
      date: DATE,
    });
  });

  it('searches after specified time', () => {
    const items = [makeItem('10:00', '11:00')];
    const result = findNextGap(items, DATE, '10:00');
    // 10:00-11:00 is occupied, next is 11:00-12:00
    expect(result).toEqual({
      startTime: '11:00',
      endTime: '12:00',
      date: DATE,
    });
  });

  it('returns null when all slots are occupied', () => {
    // Fill every hour from 06:00 to 21:00
    const items = [];
    for (let h = 6; h < 21; h++) {
      items.push(makeItem(
        `${String(h).padStart(2, '0')}:00`,
        `${String(h + 1).padStart(2, '0')}:00`,
      ));
    }
    const result = findNextGap(items, DATE);
    expect(result).toBeNull();
  });

  it('ignores items on different dates', () => {
    const otherDateItem: ScheduleItemForTemplate = {
      category: 'User',
      start: '2026-03-19T06:00:00',
      end: '2026-03-19T07:00:00',
      userId: 'user-1',
    };
    const result = findNextGap([otherDateItem], DATE);
    // Should return the first slot since the item is on a different date
    expect(result).toEqual({
      startTime: '06:00',
      endTime: '07:00',
      date: DATE,
    });
  });

  it('handles partially overlapping items', () => {
    // Item spans 06:30-07:30, overlapping both 06:00-07:00 and 07:00-08:00
    const items = [makeItem('06:30', '07:30')];
    const result = findNextGap(items, DATE);
    // Both 06:00-07:00 and 07:00-08:00 are occupied
    expect(result).toEqual({
      startTime: '08:00',
      endTime: '09:00',
      date: DATE,
    });
  });

  it('finds gap between occupied slots', () => {
    const items = [
      makeItem('06:00', '07:00'),
      // gap at 07:00-08:00
      makeItem('08:00', '09:00'),
    ];
    const result = findNextGap(items, DATE);
    expect(result).toEqual({
      startTime: '07:00',
      endTime: '08:00',
      date: DATE,
    });
  });

  it('returns null when afterTime is past business end', () => {
    const result = findNextGap([], DATE, '21:00');
    expect(result).toBeNull();
  });
});

// ── countRemainingGaps ────────────────────────────────────────────────────

describe('countRemainingGaps', () => {
  it('returns 15 for empty day (06:00-21:00, 60-min slots)', () => {
    expect(countRemainingGaps([], DATE)).toBe(15);
  });

  it('returns 14 when one slot is occupied', () => {
    const items = [makeItem('10:00', '11:00')];
    expect(countRemainingGaps(items, DATE)).toBe(14);
  });

  it('returns 0 when all slots are filled', () => {
    const items = [];
    for (let h = 6; h < 21; h++) {
      items.push(makeItem(
        `${String(h).padStart(2, '0')}:00`,
        `${String(h + 1).padStart(2, '0')}:00`,
      ));
    }
    expect(countRemainingGaps(items, DATE)).toBe(0);
  });
});
