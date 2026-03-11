/**
 * businessJournalPreviewHelpers — Pure Function Tests
 *
 * Covers all exported pure helpers:
 *   - getDaysInMonth
 *   - getDayColor
 *   - getDayLabel
 *   - buildTooltipLines
 *
 * No React, no mocks, no timers. Pure input/output assertions only.
 */
import { describe, expect, it } from 'vitest';

import {
    buildTooltipLines,
    getDayColor,
    getDayLabel,
    getDaysInMonth,
    type JournalDayEntry,
} from '../businessJournalPreviewHelpers';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseEntry = (): JournalDayEntry => ({
  date: '2024-01-15',
  attendance: '出席',
  amActivities: [],
  pmActivities: [],
});

// ── getDaysInMonth ────────────────────────────────────────────────────────────

describe('getDaysInMonth', () => {
  it('January has 31 days', () => {
    expect(getDaysInMonth(2024, 1)).toBe(31);
  });

  it('February 2024 (leap year) has 29 days', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
  });

  it('February 2023 (non-leap year) has 28 days', () => {
    expect(getDaysInMonth(2023, 2)).toBe(28);
  });

  it('April has 30 days', () => {
    expect(getDaysInMonth(2024, 4)).toBe(30);
  });

  it('December has 31 days', () => {
    expect(getDaysInMonth(2024, 12)).toBe(31);
  });
});

// ── getDayColor ───────────────────────────────────────────────────────────────

describe('getDayColor', () => {
  // 2024-01-07 = Sunday
  it('Sunday returns red (#f44336)', () => {
    expect(getDayColor(2024, 1, 7)).toBe('#f44336');
  });

  // 2024-01-06 = Saturday
  it('Saturday returns blue (#2196f3)', () => {
    expect(getDayColor(2024, 1, 6)).toBe('#2196f3');
  });

  // 2024-01-01 = Monday
  it('Weekday returns "inherit"', () => {
    expect(getDayColor(2024, 1, 1)).toBe('inherit');
  });

  // 2024-01-05 = Friday
  it('Friday (weekday) returns "inherit"', () => {
    expect(getDayColor(2024, 1, 5)).toBe('inherit');
  });
});

// ── getDayLabel ───────────────────────────────────────────────────────────────

describe('getDayLabel', () => {
  // 2024-01-01 = Monday
  it('Monday → 月', () => {
    expect(getDayLabel(2024, 1, 1)).toBe('月');
  });

  // 2024-01-06 = Saturday
  it('Saturday → 土', () => {
    expect(getDayLabel(2024, 1, 6)).toBe('土');
  });

  // 2024-01-07 = Sunday
  it('Sunday → 日', () => {
    expect(getDayLabel(2024, 1, 7)).toBe('日');
  });

  // 2024-01-03 = Wednesday
  it('Wednesday → 水', () => {
    expect(getDayLabel(2024, 1, 3)).toBe('水');
  });
});

// ── buildTooltipLines ─────────────────────────────────────────────────────────

describe('buildTooltipLines', () => {
  it('休日 returns empty array', () => {
    const entry: JournalDayEntry = { ...baseEntry(), attendance: '休日' };
    expect(buildTooltipLines(entry)).toEqual([]);
  });

  it('出席 without meal or activities returns only attendance line', () => {
    const entry: JournalDayEntry = { ...baseEntry(), attendance: '出席' };
    expect(buildTooltipLines(entry)).toEqual(['出欠: 出席']);
  });

  it('includes mealAmount when present', () => {
    const entry: JournalDayEntry = { ...baseEntry(), mealAmount: '完食' };
    const lines = buildTooltipLines(entry);
    expect(lines).toContain('食事: 完食');
  });

  it('includes AM activities when present', () => {
    const entry: JournalDayEntry = { ...baseEntry(), amActivities: ['軽作業', 'ストレッチ'] };
    const lines = buildTooltipLines(entry);
    expect(lines).toContain('AM: 軽作業, ストレッチ');
  });

  it('includes PM activities when present', () => {
    const entry: JournalDayEntry = { ...baseEntry(), pmActivities: ['読書'] };
    const lines = buildTooltipLines(entry);
    expect(lines).toContain('PM: 読書');
  });

  it('includes specialNotes when present', () => {
    const entry: JournalDayEntry = { ...baseEntry(), specialNotes: '体調変化あり' };
    const lines = buildTooltipLines(entry);
    expect(lines).toContain('特記: 体調変化あり');
  });

  it('full entry returns all 5 lines in correct order', () => {
    const entry: JournalDayEntry = {
      ...baseEntry(),
      attendance: '遅刻',
      mealAmount: '半分',
      amActivities: ['園芸'],
      pmActivities: ['音楽活動'],
      specialNotes: '記録あり',
    };
    expect(buildTooltipLines(entry)).toEqual([
      '出欠: 遅刻',
      '食事: 半分',
      'AM: 園芸',
      'PM: 音楽活動',
      '特記: 記録あり',
    ]);
  });

  it('omits empty activity arrays', () => {
    const entry: JournalDayEntry = {
      ...baseEntry(),
      amActivities: [],
      pmActivities: [],
    };
    const lines = buildTooltipLines(entry);
    expect(lines.some((l) => l.startsWith('AM:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('PM:'))).toBe(false);
  });
});
