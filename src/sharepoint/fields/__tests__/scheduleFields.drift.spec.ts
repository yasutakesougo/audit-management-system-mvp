import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SCHEDULE_EVENTS_CANDIDATES,
  SCHEDULE_EVENTS_ESSENTIALS,
} from '../scheduleFields';

describe('Schedule Events Drift Resistance', () => {
  const cands = SCHEDULE_EVENTS_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (Title, EventDate, EndDate) が解決される', () => {
    const available = new Set(['Id', 'Title', 'EventDate', 'EndDate', 'Status']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.title).toBe('Title');
    expect(fieldStatus.title.isDrifted).toBe(false);
    
    expect(resolved.start).toBe('EventDate');
    expect(fieldStatus.start.isDrifted).toBe(false);
    
    expect(resolved.end).toBe('EndDate');
    expect(fieldStatus.end.isDrifted).toBe(false);
  });

  it('再送付用内部名 (cr014_status, cr014_rowKey) が解決される (WARN)', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'cr014_status', 'cr014_rowKey']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.status).toBe('cr014_status');
    expect(fieldStatus.status.isDrifted).toBe(true);
    
    expect(resolved.rowKey).toBe('cr014_rowKey');
    expect(fieldStatus.rowKey.isDrifted).toBe(true);
  });

  it('必須チェック（title, start, end）が機能する', () => {
    const { resolved } = resolveInternalNamesDetailed(new Set(['Title', 'EventDate', 'EndDate']), cands);
    const essentials = SCHEDULE_EVENTS_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('スタート日が欠落している場合に FAIL 判定', () => {
    const { resolved } = resolveInternalNamesDetailed(new Set(['Title', 'EndDate']), cands);
    const essentials = SCHEDULE_EVENTS_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
