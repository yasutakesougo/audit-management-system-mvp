import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  MEETING_MINUTES_CANDIDATES,
  MEETING_MINUTES_ESSENTIALS,
} from '../meetingMinutesFields';

describe('Meeting Minutes Drift Resistance', () => {
  const cands = MEETING_MINUTES_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (MeetingDate, Category) が解決される', () => {
    const available = new Set(['Id', 'Title', 'MeetingDate', 'Category', 'Summary']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.meetingDate).toBe('MeetingDate');
    expect(fieldStatus.meetingDate.isDrifted).toBe(false);
    
    expect(resolved.category).toBe('Category');
    expect(fieldStatus.category.isDrifted).toBe(false);
  });

  it('cr013_meetingDate / cr013_category が解決される (drift)', () => {
    const available = new Set(['cr013_meetingDate', 'cr013_category', 'Summary']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.meetingDate).toBe('cr013_meetingDate');
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
    
    expect(resolved.category).toBe('cr013_category');
    expect(fieldStatus.category.isDrifted).toBe(true);
  });

  it('代替名 Date / MeetingCategory が解決される (drift)', () => {
    const available = new Set(['Date', 'MeetingCategory']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.meetingDate).toBe('Date');
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
    
    expect(resolved.category).toBe('MeetingCategory');
    expect(fieldStatus.category.isDrifted).toBe(true);
  });

  it('必須チェック（meetingDate, category）が機能する', () => {
    const available = new Set(['MeetingDate', 'Category']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = MEETING_MINUTES_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('Category が欠落している場合に FAIL 判定', () => {
    const available = new Set(['MeetingDate', 'Summary']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = MEETING_MINUTES_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
