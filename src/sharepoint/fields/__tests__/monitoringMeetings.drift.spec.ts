import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ESSENTIALS,
  MONITORING_MEETING_FIELDS,
} from '../monitoringMeetingFields';

describe('MONITORING_MEETING_CANDIDATES drift', () => {
  const allFieldCandidates = MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (cr014_... ) がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title',
      ...Object.values(MONITORING_MEETING_FIELDS)
    ]);
    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );

    expect(resolved.recordId).toBe(MONITORING_MEETING_FIELDS.recordId);
    expect(resolved.userId).toBe(MONITORING_MEETING_FIELDS.userId);
    expect(resolved.meetingDate).toBe(MONITORING_MEETING_FIELDS.meetingDate);
    expect(missing).toHaveLength(0);
    expect(fieldStatus.recordId.isDrifted).toBe(false);
    expect(fieldStatus.userId.isDrifted).toBe(false);
  });

  it('RecordId / UserId などのシンプル名称が解決される (WARN / DRIFT)', () => {
    const available = new Set([
      'Id', 'Title', 'RecordId', 'UserId', 'MeetingDate'
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );

    expect(resolved.recordId).toBe('RecordId');
    expect(resolved.userId).toBe('UserId');
    expect(resolved.meetingDate).toBe('MeetingDate');
    // 基準名 (cr014_... ) ではないため isDrifted=true
    expect(fieldStatus.recordId.isDrifted).toBe(true);
    expect(fieldStatus.userId.isDrifted).toBe(true);
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
  });

  it('必須フィールド (recordId, userId, meetingDate) が揃えば isHealthy=true', () => {
    const available = new Set([
      'RecordId', 'UserId', 'MeetingDate'
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );
    const essentials = MONITORING_MEETING_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('recordId が欠落していれば isHealthy=false', () => {
    const available = new Set(['UserId', 'MeetingDate']);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      allFieldCandidates,
    );
    const essentials = MONITORING_MEETING_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});
