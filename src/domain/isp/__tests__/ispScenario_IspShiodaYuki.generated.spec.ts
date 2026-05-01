/**
 * AUTO-GENERATED SCENARIO TEST
 * Source: knowledge/ingested/official_forms/isp_shioda_yuki.md
 * Generated: 2026-04-12T11:37:15.356Z
 */
import { describe, expect, it } from 'vitest';
import type { IndividualSupportPlan } from '../types';
import { 
  computeMonitoringSummary,
  type MonitoringMeetingRecord 
} from '../monitoringMeeting';

describe('ISP Scenario (Generated): 塩田 幸基（Shioda Yuki）', () => {
  const isp: IndividualSupportPlan = {
    id: 'isp-isp_shioda_yuki',
    userId: 5203,
    status: 'implementation',
    version: 'v1.0',
    createdAt: '2026-04-01T00:00:00Z',
    createdBy: 1,
    updatedAt: '2026-04-01T00:00:00Z',
    updatedBy: 1,
    personalIntention: '',
    familyIntention: '',
    overallSupportPolicy: '',
    qolImprovementIssues: [],
    longTermGoals: [
  "自分の予定を把握し、見通しを持って落ち着いて活動に取り組む。",
  "興味のある活動を広げ、充実した時間を過ごす。"
],
    shortTermGoals: [
  "スケジュール表を確認し、次の活動を理解する。",
  "制限のある活動（ハサミ等）に代わる、没頭できる新しいプログラムを見つける。",
  "## 留意事項",
  "ハサミの使用には制限があるため、不穏にならないよう代替活動を提示する。"
],
    targetDate: '2026-03-31',
    precautions: [],
    deliveryRecords: [],
    meetingRecords: [],
    monitoringRecords: [],
    reviewHistory: [],
  };

  it('should have correctly parsed goals from Markdown', () => {
    expect(isp.longTermGoals).toHaveLength(2);
    expect(isp.shortTermGoals).toHaveLength(4);
  });

  
  it('should validate monitoring check for 9月 (interim)', () => {
    const year = 2026;
    const records: MonitoringMeetingRecord[] = [
      {
        id: 'mtg-0',
        userId: '5203',
        ispId: isp.id,
        meetingType: 'interim',
        meetingDate: `${year}-${'9'.padStart(2, '0')}-15`,
        venue: 'Default',
        attendees: [],
        goalEvaluations: [
          { goalText: 'Goal 1', achievementLevel: 'mostly_achieved', comment: '実施中 (○)' }
        ],
        overallAssessment: '',
        userFeedback: '',
        familyFeedback: '',
        planChangeDecision: 'no_change',
        changeReason: '',
        decisions: ["代替プログラムの探索"],
        nextMonitoringDate: '',
        recordedBy: 'Auto',
        recordedAt: '',
        status: 'finalized',
        discussionSummary: '',
      }
    ];

    const summary = computeMonitoringSummary(records, `${year}-10-01`);
    expect(summary.totalMeetings).toBe(1);
    
  });
  

  it('should validate monitoring check for 3月 (regular)', () => {
    const year = 2027;
    const records: MonitoringMeetingRecord[] = [
      {
        id: 'mtg-1',
        userId: '5203',
        ispId: isp.id,
        meetingType: 'regular',
        meetingDate: `${year}-${'3'.padStart(2, '0')}-15`,
        venue: 'Default',
        attendees: [],
        goalEvaluations: [
          { goalText: 'Goal 1', achievementLevel: 'mostly_achieved', comment: '達成 (◎)' }
        ],
        overallAssessment: '',
        userFeedback: '',
        familyFeedback: '',
        planChangeDecision: 'major_revision',
        changeReason: '',
        decisions: ["次期計画への大幅改訂 (Major Revision)"],
        nextMonitoringDate: '',
        recordedBy: 'Auto',
        recordedAt: '',
        status: 'finalized',
        discussionSummary: '',
      }
    ];

    const summary = computeMonitoringSummary(records, `${year}-10-01`);
    expect(summary.totalMeetings).toBe(1);
    expect(summary.pendingPlanChanges).toBe(1);
  });
  

  it('should validate the 6-month monitoring continuity for the whole period', () => {
    const records: MonitoringMeetingRecord[] = [
      {
        userId: '5203',
        meetingType: 'interim',
        meetingDate: '2026-09-15',
        goalEvaluations: [],
        planChangeDecision: 'no_change',
      },
      {
        userId: '5203',
        meetingType: 'regular',
        meetingDate: '2027-03-15',
        goalEvaluations: [],
        planChangeDecision: 'major_revision',
      }
    ] as unknown as MonitoringMeetingRecord[];

    const summary = computeMonitoringSummary(records, '2027-03-31');
    // If gaps are too wide, this would be true. Given the template dates (09-15 and 03-15), it should be false (within 183 days).
    expect(summary.hasContinuityViolation).toBe(false);
  });
});