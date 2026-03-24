import { describe, expect, it } from 'vitest';
import {
  formatRingValueText,
  formatRingSubText,
} from '../formatRingValueText';

// ─── formatRingValueText ─────────────────────────────────────

describe('formatRingValueText', () => {
  // ── records ──

  it('shows remaining count for records', () => {
    expect(formatRingValueText({ key: 'records', completed: 3, total: 12 }))
      .toBe('あと9');
  });

  it('shows 完了 when records all done', () => {
    expect(formatRingValueText({ key: 'records', completed: 12, total: 12 }))
      .toBe('完了');
  });

  it('shows – when records total is 0', () => {
    expect(formatRingValueText({ key: 'records', completed: 0, total: 0 }))
      .toBe('–');
  });

  it('clamps negative remaining to 0 for records', () => {
    expect(formatRingValueText({ key: 'records', completed: 15, total: 12 }))
      .toBe('完了');
  });

  // ── caseRecords ──

  it('shows remaining count for caseRecords', () => {
    expect(formatRingValueText({ key: 'caseRecords', completed: 1, total: 10 }))
      .toBe('あと9');
  });

  it('shows 完了 when caseRecords all done', () => {
    expect(formatRingValueText({ key: 'caseRecords', completed: 10, total: 10 }))
      .toBe('完了');
  });

  // ── attendance ──

  it('shows fraction for attendance', () => {
    expect(formatRingValueText({ key: 'attendance', completed: 8, total: 10 }))
      .toBe('8/10');
  });

  it('shows – when attendance total is 0', () => {
    expect(formatRingValueText({ key: 'attendance', completed: 0, total: 0 }))
      .toBe('–');
  });

  // ── contacts ──

  it('shows count for contacts', () => {
    expect(formatRingValueText({ key: 'contacts', completed: 3, total: 3 }))
      .toBe('3件');
  });

  it('shows 0件 for contacts when none', () => {
    expect(formatRingValueText({ key: 'contacts', completed: 0, total: 0 }))
      .toBe('0件');
  });
});

// ─── formatRingSubText ───────────────────────────────────────

describe('formatRingSubText', () => {
  // ── records ──

  it('shows fraction as subtext for records with remaining', () => {
    expect(formatRingSubText('records', 3, 12)).toBe('3/12');
  });

  it('shows 完了 as subtext for completed records', () => {
    expect(formatRingSubText('records', 12, 12)).toBe('完了');
  });

  it('returns null for records with zero total', () => {
    expect(formatRingSubText('records', 0, 0)).toBeNull();
  });

  // ── caseRecords ──

  it('shows fraction as subtext for caseRecords with remaining', () => {
    expect(formatRingSubText('caseRecords', 5, 10)).toBe('5/10');
  });

  // ── attendance ──

  it('shows 全員出席 when all present', () => {
    expect(formatRingSubText('attendance', 10, 10)).toBe('全員出席');
  });

  it('shows absent count when not all present', () => {
    expect(formatRingSubText('attendance', 8, 10)).toBe('欠2');
  });

  it('returns null for attendance with zero total', () => {
    expect(formatRingSubText('attendance', 0, 0)).toBeNull();
  });

  // ── contacts ──

  it('shows 対応済 for zero contacts', () => {
    expect(formatRingSubText('contacts', 0, 0)).toBe('対応済');
  });

  it('returns null for non-zero contacts', () => {
    expect(formatRingSubText('contacts', 3, 3)).toBeNull();
  });
});
