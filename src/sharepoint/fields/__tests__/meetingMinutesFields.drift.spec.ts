/**
 * Meeting Minutes drift 耐性テスト
 *
 * MEETING_MINUTES_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * シナリオ:
 *  1. 標準名 (MeetingDate, Category) が解決される
 *  2. meetingDate が cr013_meetingDate / Date に drift した場合を吸収
 *  3. category が cr013_category / MeetingCategory に drift した場合を吸収
 *  4. summary が Notes に drift した場合を吸収
 *  5. 必須2フィールド (meetingDate/category) が揃えば isHealthy=true
 *  6. 必須フィールド欠落で isHealthy=false（各ケース）
 *  7. optional フィールド欠落でも isHealthy=true（WARN 水準）
 *  8. unresolved キーが missing として検知される（silent drop しない）
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  MEETING_MINUTES_CANDIDATES,
  MEETING_MINUTES_ESSENTIALS,
} from '../meetingMinutesFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    MEETING_MINUTES_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = MEETING_MINUTES_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

// ── 1. 標準名 ────────────────────────────────────────────────────────────────

describe('MEETING_MINUTES_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'MeetingDate', 'Category', 'Summary', 'Decisions', 'Actions', 'Attendees',
  ]);

  it('必須2フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.meetingDate).toBe('MeetingDate');
    expect(resolved.category).toBe('Category');
    expect(missing).not.toContain('meetingDate');
    expect(missing).not.toContain('category');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.meetingDate.isDrifted).toBe(false);
    expect(fieldStatus.category.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. meetingDate の drift パターン ────────────────────────────────────────

describe('MEETING_MINUTES_CANDIDATES — meetingDate drift', () => {
  it('cr013_meetingDate が meetingDate として解決される', () => {
    const available = new Set(['cr013_meetingDate', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.meetingDate).toBe('cr013_meetingDate');
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('Date が meetingDate として解決される', () => {
    const available = new Set(['Date', 'Category']);
    const { resolved } = resolve(available);
    expect(resolved.meetingDate).toBe('Date');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 3. category の drift パターン ────────────────────────────────────────────

describe('MEETING_MINUTES_CANDIDATES — category drift', () => {
  it('cr013_category が category として解決される', () => {
    const available = new Set(['MeetingDate', 'cr013_category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.category).toBe('cr013_category');
    expect(fieldStatus.category.isDrifted).toBe(true);
  });

  it('MeetingCategory が category として解決される', () => {
    const available = new Set(['MeetingDate', 'MeetingCategory']);
    const { resolved } = resolve(available);
    expect(resolved.category).toBe('MeetingCategory');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 4. summary の drift パターン ─────────────────────────────────────────────

describe('MEETING_MINUTES_CANDIDATES — summary drift', () => {
  it('Notes が summary として解決される（drift）', () => {
    const available = new Set(['MeetingDate', 'Category', 'Notes']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.summary).toBe('Notes');
    expect(fieldStatus.summary.isDrifted).toBe(true);
  });
});

// ── 5〜8. FAIL/WARN 境界 ──────────────────────────────────────────────────────

describe('MEETING_MINUTES_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須2点のみでも isHealthy=true（最小構成）', () => {
    const { resolved } = resolve(new Set(['MeetingDate', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('meetingDate が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('category が完全欠落すれば isHealthy=false（FAIL）', () => {
    const { resolved } = resolve(new Set(['MeetingDate']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('summary / decisions / actions 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const { resolved, missing } = resolve(new Set(['MeetingDate', 'Category']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('summary');
    expect(missing).toContain('decisions');
    expect(missing).toContain('actions');
  });

  it('drift 経由2点でも isHealthy=true', () => {
    const { resolved } = resolve(new Set(['cr013_meetingDate', 'MeetingCategory']));
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const { missing } = resolve(new Set(['SomeUnknownFieldOnly']));
    expect(missing).toContain('meetingDate');
    expect(missing).toContain('category');
    expect(missing).toContain('summary');
    expect(missing).toContain('attendees');
  });
});
