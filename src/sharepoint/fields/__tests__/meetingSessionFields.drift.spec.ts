import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  MEETING_SESSIONS_CANDIDATES,
  MEETING_SESSIONS_ESSENTIALS,
} from '../meetingSessionFields';

describe('Meeting Sessions Drift Resistance', () => {
  const cands = MEETING_SESSIONS_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (SessionKey, MeetingKind, Date) が解決される', () => {
    const available = new Set(['Id', 'Title', 'SessionKey', 'MeetingKind', 'Date', 'Status']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.sessionKey).toBe('SessionKey');
    expect(fieldStatus.sessionKey.isDrifted).toBe(true);
    
    expect(resolved.meetingKind).toBe('MeetingKind');
    expect(fieldStatus.meetingKind.isDrifted).toBe(true);
    
    expect(resolved.date).toBe('Date');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('cr013_sessionKey / cr013_meetingKind が解決される (drift)', () => {
    const available = new Set(['cr013_sessionKey', 'cr013_meetingKind', 'Date']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.sessionKey).toBe('cr013_sessionKey');
    expect(fieldStatus.sessionKey.isDrifted).toBe(true);
    
    expect(resolved.meetingKind).toBe('cr013_meetingKind');
    expect(fieldStatus.meetingKind.isDrifted).toBe(true);
  });

  it('代替名 Key / MeetingDate が解決される (drift)', () => {
    const available = new Set(['Key', 'Kind', 'MeetingDate']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.sessionKey).toBe('Key');
    expect(fieldStatus.sessionKey.isDrifted).toBe(true);
    
    expect(resolved.date).toBe('MeetingDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('必須チェック（sessionKey, meetingKind, date）が機能する', () => {
    const available = new Set(['SessionKey', 'MeetingKind', 'Date']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = MEETING_SESSIONS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('MeetingKind が欠落している場合に FAIL 判定', () => {
    const available = new Set(['SessionKey', 'Date']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = MEETING_SESSIONS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
