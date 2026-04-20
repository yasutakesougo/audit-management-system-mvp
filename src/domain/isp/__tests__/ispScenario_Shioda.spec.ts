import { describe, expect, it } from 'vitest';
import type { 
  IndividualSupportPlan 
} from '../types';
import { 
  computeMonitoringSummary,
  type MonitoringMeetingRecord 
} from '../monitoringMeeting';

/**
 * Shioda Yuki ISP Scenario Test
 * 
 * This test uses real-world data ingested from:
 * knowledge/ingested/official_forms/isp_shioda_yuki.md
 * 
 * Goal: Verify that the domain model can represent the complex state of 
 * a user with specific behavioral support needs and adaptive plan changes.
 */
describe('ISP Scenario: Shioda Yuki (Ingested)', () => {
  
  const shiodaIsp: IndividualSupportPlan = {
    id: 'isp-shioda-2026',
    userId: 5203, // Internal ID from SharePoint path s/5203
    status: 'implementation',
    version: 'v1',
    createdAt: '2026-04-01T09:00:00Z',
    createdBy: 1,
    updatedAt: '2026-04-01T09:00:00Z',
    updatedBy: 1,
    
    personalIntention: '楽しく活動に参加したい。',
    familyIntention: '安心できる環境で過ごしてほしい。',
    overallSupportPolicy: '見通しを持って落ち着いて活動に取り組むための環境調整と、興味関心の拡大。',
    
    qolImprovementIssues: ['ハサミ作業への強いこだわりと制限によるストレス'],
    longTermGoals: [
      '自分の予定を把握し、見通しを持って落ち着いて活動に取り組む。',
      '興味のある活動を広げ、充実した時間を過ごす。'
    ],
    shortTermGoals: [
      'スケジュール表を確認し、次の活動を理解する。',
      '制限のある活動（ハサミ等）に代わる、没頭できる新しいプログラムを見つける。'
    ],
    targetDate: '2027-03-31',
    precautions: ['ハサミの使用には制限があるため、不穏にならないよう代替活動を提示する。'],
    
    deliveryRecords: [],
    meetingRecords: [],
    monitoringRecords: [],
    reviewHistory: [],
  };

  it('should represent the core ISP with specific behavioral goals', () => {
    expect(shiodaIsp.shortTermGoals).toHaveLength(2);
    expect(shiodaIsp.shortTermGoals[1]).toContain('ハサミ');
    expect(shiodaIsp.qolImprovementIssues[0]).toContain('こだわり');
  });

  it('should handle the September monitoring update (Interim)', () => {
    const septMonitoring: MonitoringMeetingRecord = {
      id: 'mtg-shioda-sept',
      userId: '5203',
      ispId: 'isp-shioda-2026',
      meetingType: 'interim',
      meetingDate: '2026-09-15',
      venue: '活動ルーム',
      attendees: [{ name: 'サビ管', role: 'サビ管', present: true }],
      goalEvaluations: [
        { 
          goalText: 'スケジュール表を確認する', 
          achievementLevel: 'mostly_achieved', 
          comment: '提示が習慣化され、本人も確認している。' 
        }
      ],
      overallAssessment: 'スケジュールの提示により安定。ハサミ制限のストレスを緩和する代替活動が必要。',
      userFeedback: 'ハサミを使いたいが、我慢している。',
      familyFeedback: '家でも落ち着いている。',
      planChangeDecision: 'no_change', // まだ大きな変更はしないが、方針を確認
      changeReason: '',
      decisions: ['現在の支援を継続。代替プログラムの探索を強化する。'],
      nextMonitoringDate: '2027-03-15',
      recordedBy: '担当員',
      recordedAt: '2026-09-15T10:00:00Z',
      status: 'finalized',
      implementationSummary: 'スケジュール提示を徹底。ハサミは制限下で最小限に使用任務。',
      discussionSummary: 'ハサミ制限の継続と代替活動の模索について検討。',
    };

    const summary = computeMonitoringSummary([septMonitoring], '2026-10-01');
    expect(summary.totalMeetings).toBe(1);
    expect(summary.isFulfilled).toBe(false); // Only 1 meeting in FY2026 so far
    expect(summary.fulfillmentRate).toBe(0.5);
  });

  it('should trigger a major revision in March monitoring for the "Scissors" issue', () => {
    const marchMonitoring: MonitoringMeetingRecord = {
      id: 'mtg-shioda-march',
      userId: '5203',
      ispId: 'isp-shioda-2026',
      meetingType: 'regular',
      meetingDate: '2027-03-10',
      venue: '相談室',
      attendees: [{ name: '保護者', role: '家族', present: true }],
      goalEvaluations: [
        { 
          goalText: 'スケジュール表を確認する', 
          achievementLevel: 'achieved', 
          comment: '完全に自立して確認できるようになった。' 
        },
        {
          goalText: '代替プログラムを見つける',
          achievementLevel: 'partial',
          comment: 'パズルなど興味を示すものが出てきたため、次期計画で強化する。'
        }
      ],
      overallAssessment: 'ハサミの制限環境でも安定して過ごせるようになった。次期計画ではパズルなどの新しい活動を中心にする。',
      userFeedback: 'パズルも楽しい。',
      familyFeedback: '新しい趣味ができて嬉しい。',
      planChangeDecision: 'major_revision', // 次期計画への大幅改訂
      changeReason: 'ハサミ制限の固定化と、代替活動（パズル）の定着に伴う支援方針の再定義。',
      decisions: ['次期個別支援計画の作成（パズル、音楽活動の追加）'],
      nextMonitoringDate: '2027-09-15',
      recordedBy: 'サビ管',
      recordedAt: '2027-03-10T10:00:00Z',
      status: 'finalized',
      discussionSummary: 'ハサミの制限を継続しつつ、利用者のQOLを低下させない活動の選択肢を増やすことを合意。',
    };

    const records = [
      { meetingDate: '2026-09-15', planChangeDecision: 'no_change' } as MonitoringMeetingRecord,
      marchMonitoring
    ];

    const summary = computeMonitoringSummary(records, '2027-03-11');
    expect(summary.isFulfilled).toBe(true); // 2 meetings in FY2026 (Apr-Mar)
    expect(summary.pendingPlanChanges).toBe(1); // One major revision pending
  });
});
