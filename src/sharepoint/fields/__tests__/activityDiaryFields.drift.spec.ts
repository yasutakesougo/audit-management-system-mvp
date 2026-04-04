import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  ACTIVITY_DIARY_CANDIDATES,
  ACTIVITY_DIARY_ESSENTIALS,
} from '../activityDiaryFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    ACTIVITY_DIARY_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = ACTIVITY_DIARY_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
}

describe('ACTIVITY_DIARY_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'UserID', 'Date', 'Shift', 'Category',
    'LunchAmount', 'MealMain', 'MealSide',
    'ProblemBehavior', 'BehaviorType', 'BehaviorNote',
    'Seizure', 'SeizureAt', 'Goals', 'Notes',
  ]);

  it('必須 4 フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.userId).toBe('UserID');
    expect(resolved.date).toBe('Date');
    expect(resolved.shift).toBe('Shift');
    expect(resolved.category).toBe('Category');
    expect(missing).toHaveLength(0);
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.userId.isDrifted).toBe(false);
    expect(fieldStatus.date.isDrifted).toBe(false);
    expect(fieldStatus.shift.isDrifted).toBe(false);
    expect(fieldStatus.category.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

describe('ACTIVITY_DIARY_CANDIDATES — UserIdId drift', () => {
  it('UserIdId が userId として解決される', () => {
    const available = new Set(['UserIdId', 'Date', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userId).toBe('UserIdId');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });

  it('UserId が userId として解決される', () => {
    const available = new Set(['UserId', 'Date', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userId).toBe('UserId');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });

  it('cr013_userId が userId として解決される', () => {
    const available = new Set(['cr013_userId', 'Date', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userId).toBe('cr013_userId');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });
});

describe('ACTIVITY_DIARY_CANDIDATES — date drift', () => {
  it('RecordDate が date として解決される', () => {
    const available = new Set(['UserID', 'RecordDate', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('RecordDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('EntryDate が date として解決される', () => {
    const available = new Set(['UserID', 'EntryDate', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('EntryDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('Date0 (suffix drift) が date として解決される', () => {
    const available = new Set(['UserID', 'Date0', 'Shift', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('Date0');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });
});

describe('ACTIVITY_DIARY_CANDIDATES — shift drift', () => {
  it('Period が shift として解決される', () => {
    const available = new Set(['UserID', 'Date', 'Period', 'Category']);
    const { resolved } = resolve(available);
    expect(resolved.shift).toBe('Period');
  });

  it('TimeSlot が shift として解決される', () => {
    const available = new Set(['UserID', 'Date', 'TimeSlot', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.shift).toBe('TimeSlot');
    expect(fieldStatus.shift.isDrifted).toBe(true);
  });

  it('Shift0 (suffix drift) が shift として解決される', () => {
    const available = new Set(['UserID', 'Date', 'Shift0', 'Category']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.shift).toBe('Shift0');
    expect(fieldStatus.shift.isDrifted).toBe(true);
  });
});

describe('ACTIVITY_DIARY_ESSENTIALS 境界', () => {
  it('必須 4 フィールドが揃えば isHealthy=true', () => {
    const available = new Set(['cr013_userId', 'EntryDate', 'Period', 'ActivityCategory']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('shift が欠落すれば isHealthy=false', () => {
    const available = new Set(['UserID', 'Date', 'Category']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('userId が欠落すれば isHealthy=false', () => {
    const available = new Set(['Date', 'Shift', 'Category']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('オプション列が欠落していても essentials が満たされれば true', () => {
    const available = new Set(['UserID', 'Date', 'Shift', 'Category']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('候補未一致時に missing に記録される', () => {
    const available = new Set(['SomeUnknownField']);
    const { missing } = resolve(available);
    expect(missing).toContain('userId');
    expect(missing).toContain('date');
    expect(missing).toContain('shift');
    expect(missing).toContain('category');
  });
});
