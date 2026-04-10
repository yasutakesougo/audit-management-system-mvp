/**
 * MonitoringMeeting drift 耐性テスト
 *
 * MONITORING_MEETING_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * シナリオ:
 *  1. cr014_ プレフィックスがそのまま解決される（drift なし）
 *  2. cr014_ プレフィックスが落ちてキャメルケース名に移行した場合を吸収
 *  3. userId が UserId / UserCode に drift した場合を吸収
 *  4. meetingDate が MeetingDate / Date に drift した場合を吸収
 *  5. _x0020_ エンコード列名 (Meeting_x0020_Date) を drift として解決
 *  6. suffix 付き列名 (cr014_meetingDate0) を drift として解決
 *  7. 必須3フィールドが揃えば areEssentialFieldsResolved=true
 *  8. 必須フィールド欠落で areEssentialFieldsResolved=false
 *  9. unresolved キーが missing として検知される（silent drop しない）
 * 10. ispId 欠落は FAIL にならない（optional 確認）
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  MONITORING_MEETING_CANDIDATES,
  MONITORING_MEETING_ESSENTIALS,
} from '../monitoringMeetingFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    MONITORING_MEETING_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = MONITORING_MEETING_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
}

// ── 1. 標準 cr014_ 名 ────────────────────────────────────────────────────────

describe('MONITORING_MEETING_CANDIDATES — cr014_ 標準名', () => {
  const available = new Set([
    'Id', 'Title',
    'cr014_recordId', 'cr014_userId', 'cr014_userName', 'cr014_ispId', 
    'cr014_planningSheetId', 'cr014_planningSheetTitle',
    'cr014_meetingType', 'cr014_meetingDate', 'cr014_venue',
    'cr014_attendeesJson', 'cr014_goalEvaluationsJson', 'cr014_overallAssessment',
    'cr014_userFeedback', 'cr014_familyFeedback',
    'cr014_planChangeDecision', 'cr014_changeReason', 'cr014_decisionsJson',
    'cr014_nextMonitoringDate', 'cr014_recordedBy', 'cr014_recordedAt',
    // 監査強化
    'cr014_implSummary', 'cr014_behaviorChange', 'cr014_effSupport',
    'cr014_issueSummary', 'cr014_discussionSummary',
    'cr014_reqPlanSheetUpd', 'cr014_reqIspUpd',
    'cr014_hasBasicTrained', 'cr014_hasPractTrained',
    'cr014_qualCheckStatus', 'cr014_nextActions',
    'cr014_status', 'cr014_finalizedAt', 'cr014_finalizedBy', 'cr014_prevMeetingId',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.recordId).toBe('cr014_recordId');
    expect(resolved.userId).toBe('cr014_userId');
    expect(resolved.meetingDate).toBe('cr014_meetingDate');
    expect(missing).toHaveLength(0);
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.recordId.isDrifted).toBe(false);
    expect(fieldStatus.userId.isDrifted).toBe(false);
    expect(fieldStatus.meetingDate.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. cr014_ プレフィックスが落ちた場合 ─────────────────────────────────────

describe('MONITORING_MEETING_CANDIDATES — cr014_ プレフィックス落ち', () => {
  it('RecordId が recordId として解決される', () => {
    const available = new Set(['RecordId', 'UserId', 'MeetingDate']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.recordId).toBe('RecordId');
    // 基準名 (cr014_recordId) ではないため isDrifted=true
    expect(fieldStatus.recordId.isDrifted).toBe(true);
  });

  it('MeetingDate が meetingDate として解決される', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId', 'MeetingDate']);
    const { resolved } = resolve(available);
    expect(resolved.meetingDate).toBe('MeetingDate');
  });

  it('3点すべてキャメルケース名でも isHealthy=true', () => {
    const available = new Set(['RecordId', 'UserId', 'MeetingDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 3. userId の drift パターン ──────────────────────────────────────────────

describe('MONITORING_MEETING_CANDIDATES — userId drift', () => {
  it('UserId が userId として解決される', () => {
    const available = new Set(['cr014_recordId', 'UserId', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('UserId');
  });

  it('UserCode が userId として解決される', () => {
    const available = new Set(['cr014_recordId', 'UserCode', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('UserCode');
  });

  it('cr014_userId0 (suffix drift) が userId として解決される', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId0', 'cr014_meetingDate']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userId).toBe('cr014_userId0');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });
});

// ── 4. meetingDate の drift パターン ────────────────────────────────────────

describe('MONITORING_MEETING_CANDIDATES — meetingDate drift', () => {
  it('MeetingDate が meetingDate として解決される', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId', 'MeetingDate']);
    const { resolved } = resolve(available);
    expect(resolved.meetingDate).toBe('MeetingDate');
  });

  it('Meeting_x0020_Date (_x0020_ drift) が meetingDate として解決される', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId', 'Meeting_x0020_Date']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.meetingDate).toBe('Meeting_x0020_Date');
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('cr014_meetingDate0 (suffix drift) が meetingDate として解決される', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId', 'cr014_meetingDate0']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.meetingDate).toBe('cr014_meetingDate0');
    expect(fieldStatus.meetingDate.isDrifted).toBe(true);
    // suffix drift でも必須が解決できれば isHealthy=true
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 5. FAIL/WARN 境界 ────────────────────────────────────────────────────────

describe('MONITORING_MEETING_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点 + optional なしでも isHealthy=true', () => {
    // 最小構成: recordId / userId / meetingDate のみ
    const available = new Set(['cr014_recordId', 'cr014_userId', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('recordId が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['cr014_userId', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('userId が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['cr014_recordId', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('meetingDate が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('ispId が欠落しても isHealthy=true（WARN 水準・optional）', () => {
    // ispId は provisioning required だが essentials に含まれない
    const available = new Set([
      'cr014_recordId', 'cr014_userId', 'cr014_meetingDate',
      // cr014_ispId なし
    ]);
    const { resolved, missing } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('ispId');
  });

  it('goalEvaluationsJson / overallAssessment 欠落でも isHealthy=true（WARN 水準）', () => {
    const available = new Set(['cr014_recordId', 'cr014_userId', 'cr014_meetingDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const available = new Set(['SomeUnknownFieldOnly']);
    const { missing } = resolve(available);
    expect(missing).toContain('recordId');
    expect(missing).toContain('userId');
    expect(missing).toContain('meetingDate');
    expect(missing).toContain('goalEvaluationsJson');
  });
});
