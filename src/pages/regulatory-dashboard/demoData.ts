/**
 * RegulatoryDashboardPage — デモデータ生成
 *
 * Repository 未接続時のフォールバック用。本番ロジックとは明確に分離。
 */
import {
  type AuditFinding,
  buildRegulatoryFindings,
  _resetFindingCounter,
} from '@/domain/regulatory';
import {
  type SevereAddonFinding,
  buildSevereAddonFindings,
  _resetAddonFindingCounter,
} from '@/domain/regulatory/severeAddonFindings';
import type { IcebergEvidenceBySheet } from '@/domain/regulatory/findingEvidenceSummary';

export function generateDemoFindings(): AuditFinding[] {
  _resetFindingCounter();
  return buildRegulatoryFindings({
    userProfile: {
      userId: 'U001',
      behaviorScore: 14,
      childBehaviorScore: null,
      disabilitySupportLevel: '4',
      serviceTypes: ['daily_life_care'],
      severeBehaviorSupportEligible: true,
      eligibilityCheckedAt: '2026-02-01',
    },
    sheets: [
      {
        id: 'sheet-1',
        userId: 'U001',
        title: '食事場面の支援計画',
        authoredByStaffId: 'S001',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-06-01',
        deliveredToUserAt: '2026-03-05',
        status: 'active',
        isCurrent: true,
      },
      {
        id: 'sheet-2',
        userId: 'U001',
        title: '移動場面の支援計画',
        authoredByStaffId: 'S002',
        applicableAddOnTypes: ['severe_disability_support'],
        nextReviewAt: '2026-01-15',
        deliveredToUserAt: null,
        status: 'active',
        isCurrent: true,
      },
    ],
    staffProfiles: new Map([
      ['S001', { staffId: 'S001', hasPracticalTraining: true, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
      ['S002', { staffId: 'S002', hasPracticalTraining: false, hasBasicTraining: true, hasBehaviorGuidanceTraining: false, hasCorePersonTraining: false, certificationCheckedAt: '2026-01-15' }],
    ]),
    records: [
      { id: 'rec-1', planningSheetId: 'sheet-1', recordDate: '2026-03-10' },
    ],
    monitoringMeetings: [],
    today: new Date().toISOString().slice(0, 10),
  });
}

/**
 * デモ用: 加算系 findings
 */
export function generateDemoSevereAddonFindings(): SevereAddonFinding[] {
  _resetAddonFindingCounter();
  const today = new Date().toISOString().slice(0, 10);
  return buildSevereAddonFindings({
    users: [
      { userId: 'U001', userName: '鈴木花子', supportLevel: '6', behaviorScore: 14, planningSheetIds: ['sheet-1'] },
      { userId: 'U002', userName: '田中太郎', supportLevel: '4', behaviorScore: 12, planningSheetIds: ['sheet-2'] },
      { userId: 'U003', userName: '佐藤次郎', supportLevel: '6', behaviorScore: 20, planningSheetIds: [] },
    ],
    totalLifeSupportStaff: 12,
    basicTrainingCompletedCount: 1,
    usersWithoutWeeklyObservation: ['U003'],
    lastReassessmentMap: new Map([
      ['U001', '2025-11-01'],
      ['U002', today],
      ['U003', null],
    ]),
    usersWithoutAuthoringQualification: ['U001'],
    usersWithoutAssignmentQualification: ['U003'],
    today,
  });
}

/**
 * デモ用: Iceberg 分析の根拠データ
 */
export function generateDemoIcebergEvidence(): IcebergEvidenceBySheet {
  return {
    sessionCount: { 'sheet-1': 3 },
    latestAnalysisDate: { 'sheet-1': '2026-03-08' },
  };
}
