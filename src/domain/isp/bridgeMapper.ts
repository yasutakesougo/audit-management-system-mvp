/**
 * Monitoring → Planning Bridge Mapper (Pure Logic)
 * 
 * L1 (モニタリング) の事実、L0 (日次) の観察を L2 (計画シート) が理解可能な
 * 「計画の種 (Candidates)」へ変換する純粋関数。
 */

import type { 
  MonitoringRecord, 
  PdcaCycleState 
} from './types';
import type { 
  MonitoringToPlanningBridge, 
  PlanningCandidate, 
  ReassessmentSignal 
} from './bridge';
import type { BehaviorMonitoringRecord } from './behaviorMonitoring';
import type { MonitoringMeetingRecord } from './monitoringMeeting';

/**
 * モニタリング会議記録をモニタリング事実レコードへ変換する
 */
export function mapMonitoringMeetingToMonitoringRecord(
  meeting: MonitoringMeetingRecord
): MonitoringRecord {
  return {
    id: meeting.id,
    monitoringDate: meeting.meetingDate,
    monitoredBy: 0, // TODO: 記録者IDの数値化が必要な場合は適宜変換
    goalAchievements: meeting.goalEvaluations.map((g, idx) => ({
      goalId: `goal-${idx}`, // IDがない場合はインデックスで仮生成
      achievementLevel: g.achievementLevel,
      comment: g.comment
    })),
    overallAssessment: meeting.overallAssessment,
    planChangeRequired: meeting.planChangeDecision !== 'no_change',
    changeReason: meeting.changeReason,
    nextMonitoringDate: meeting.nextMonitoringDate
  };
}


/**
 * モニタリング結果と PDCA 状態から、計画シート用の候補を生成する。
 */
export function mapMonitoringToPlanningBridge(
  planningSheetId: string,
  monitoringRecords: MonitoringRecord[],
  behaviorMonitoringRecord: BehaviorMonitoringRecord | null,
  pdcaState: PdcaCycleState | null
): MonitoringToPlanningBridge {
  const candidates: PlanningCandidate[] = [];
  
  // 1. L1 モニタリング総評から候補を生成
  const latestMonitoring = monitoringRecords.length > 0 
    ? [...monitoringRecords].sort((a, b) => b.monitoringDate.localeCompare(a.monitoringDate))[0]
    : null;

  if (latestMonitoring && latestMonitoring.overallAssessment) {
    candidates.push({
      id: `cand-mon-${latestMonitoring.id}`,
      type: 'hypothesis',
      content: latestMonitoring.overallAssessment,
      provenance: {
        sourceId: latestMonitoring.id,
        sourceType: 'monitoring',
        observedAt: latestMonitoring.monitoringDate,
        authorId: latestMonitoring.monitoredBy
      },
      suggestedAction: 'refine',
      confidence: 0.8,
      reason: 'ISPモニタリングの総評に基づき、現在の仮説の更新を提案します。'
    });
  }

  // 2. L2 行動モニタリングから候補を生成
  if (behaviorMonitoringRecord) {
    if (behaviorMonitoringRecord.summary) {
      candidates.push({
        id: `cand-beh-${behaviorMonitoringRecord.id}`,
        type: 'observation',
        content: behaviorMonitoringRecord.summary,
        provenance: {
          sourceId: behaviorMonitoringRecord.id,
          sourceType: 'daily',
          observedAt: behaviorMonitoringRecord.periodEnd,
        },
        suggestedAction: 'add',
        confidence: 0.9,
        reason: '直近の行動モニタリング所見に基づき、観察事実の追記を推奨します。'
      });
    }
  }

  // 3. PDCA ヘルススコアから「リスク・留意点」を抽出
  if (pdcaState && pdcaState.healthScore < 0.6) {
    candidates.push({
      id: `cand-pdca-${pdcaState.planningSheetId}`,
      type: 'risk',
      content: `PDCA ヘルススコアが低下しています (${Math.round(pdcaState.healthScore * 100)}%)。`,
      provenance: {
        sourceId: pdcaState.planningSheetId,
        sourceType: 'pdca',
        observedAt: pdcaState.computedAt
      },
      suggestedAction: 'add',
      confidence: 0.9,
      reason: 'PDCA のサイクルが停滞しており、環境調整の見直しが必要です。'
    });
  }

  // 3. 再評価シグナルの構築
  const reassessmentSignal: ReassessmentSignal = {
    isRequired: latestMonitoring?.planChangeRequired || (pdcaState?.healthScore ?? 1.0) < 0.4,
    reason: latestMonitoring?.changeReason || (pdcaState ? `PDCA停滞 (${pdcaState.healthScore})` : 'データ不足'),
    priority: latestMonitoring?.planChangeRequired ? 'high' : 'medium',
    triggerPhase: pdcaState?.currentPhase ?? 'unknown'
  };

  return {
    planningSheetId,
    candidates,
    reassessmentSignal
  };
}

/**
 * 複数のモニタリングデータを要約する
 */
export function summarizeMonitoringForPlanning(records: MonitoringRecord[]): string {
  if (records.length === 0) return 'モニタリング記録なし';
  return records.map(r => `【${r.monitoringDate}】${r.overallAssessment}`).join('\n');
}
