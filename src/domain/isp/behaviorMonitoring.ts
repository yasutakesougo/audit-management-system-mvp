// ---------------------------------------------------------------------------
// BehaviorMonitoringRecord — L2 行動モニタリングのドメイン型
//
// ISPモニタリング（MonitoringMeetingRecord）とは明確に分離。
//
//   ISPモニタリング（L1）: 生活全体 / 目標 / QOL → ISP更新
//   行動モニタリング（L2）: 行動 / 環境 / 支援方法 → 支援計画シート更新
//
// @see docs/architecture/isp-three-layer-model.md
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 目標評価の達成度（行動支援の文脈） */
export const behaviorAchievementValues = [
  'effective',         // 有効（継続推奨）
  'mostly_effective',  // 概ね有効
  'partial',           // 一部有効
  'not_effective',     // 効果なし（見直し必要）
  'not_observed',      // 未観察（評価不能）
] as const;

export type BehaviorAchievementLevel = (typeof behaviorAchievementValues)[number];

export const BEHAVIOR_ACHIEVEMENT_LABELS: Record<BehaviorAchievementLevel, string> = {
  effective: '有効',
  mostly_effective: '概ね有効',
  partial: '一部有効',
  not_effective: '効果なし',
  not_observed: '未観察',
} as const;

/** 支援方法の評価エントリ */
export interface SupportMethodEvaluation {
  /** 対象の支援方法 */
  methodDescription: string;
  /** 有効度 */
  achievementLevel: BehaviorAchievementLevel;
  /** 観察コメント */
  comment: string;
}

/** 環境調整の効果エントリ */
export interface EnvironmentFinding {
  /** 環境調整の内容 */
  adjustment: string;
  /** 効果があったか */
  wasEffective: boolean;
  /** 観察コメント */
  comment: string;
}

/** 行動モニタリング記録 — L2 支援計画シート更新用 */
export interface BehaviorMonitoringRecord {
  /** レコード ID */
  id: string;
  /** 対象利用者 ID */
  userId: string;
  /** 紐づく支援計画シート ID */
  planningSheetId: string;

  // ── モニタリング期間 ──

  /** モニタリング開始日 (ISO 8601 date) */
  periodStart: string;
  /** モニタリング終了日 (ISO 8601 date) */
  periodEnd: string;

  // ── 支援方法の評価 ──

  /** 支援方法の評価リスト */
  supportEvaluations: SupportMethodEvaluation[];

  // ── 環境 ──

  /** 環境調整の効果観察 */
  environmentFindings: EnvironmentFinding[];

  // ── 行動観察 ──

  /** 有効だった支援（自由記述） */
  effectiveSupports: string;
  /** 困難が見られた場面（自由記述） */
  difficultiesObserved: string;
  /** 新たに発見されたトリガー */
  newTriggers: string[];
  /** 医療・安全面の追記事項 */
  medicalSafetyNotes: string;

  // ── フィードバック ──

  /** 利用者の意向・反応 */
  userFeedback: string;
  /** 家族の意向・連絡 */
  familyFeedback: string;

  // ── 結論 ──

  /** 推奨する計画変更事項 */
  recommendedChanges: string[];
  /** 総合所見 */
  summary: string;

  // ── メタ ──

  /** 記録者氏名 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Adapter: MonitoringMeetingRecord → BehaviorMonitoringRecord
//
// ISPモニタリング会議記録から行動モニタリング記録への暫定変換。
// 将来 BehaviorMonitoringRecord が直接入力されるようになれば不要。
// ---------------------------------------------------------------------------

import type { MonitoringMeetingRecord } from './monitoringMeeting';

/**
 * @deprecated 制度上、ISPモニタリングと支援計画シート再評価（行動モニタリング）は混同してはならないため、この型変換は原則非推奨です。
 *
 * ISPモニタリング会議記録（第1層）から行動モニタリング記録（第2層）への暫定変換用 adapter です。
 * 現在は UI が統合されているための暫定措置であり、
 * 将来的に「行動モニタリング直接入力 UI」および「ルーティング分離」が実装された段階で本関数は削除されます。
 * （監査対応上、この同一視変換ルートが正式な運用とみなされることは避ける必要があります）
 *
 * goalEvaluations → supportEvaluations に変換する際、
 * 達成度を行動支援文脈に読み替える。
 */
export function adaptMeetingToBehavior(
  meeting: MonitoringMeetingRecord,
  planningSheetId: string,
): BehaviorMonitoringRecord {
  // 達成度マッピング: ISP → 行動
  const levelMap: Record<string, BehaviorAchievementLevel> = {
    achieved: 'effective',
    mostly_achieved: 'mostly_effective',
    partial: 'partial',
    not_achieved: 'not_effective',
    not_evaluable: 'not_observed',
  };

  return {
    id: `bm-from-${meeting.id}`,
    userId: meeting.userId,
    planningSheetId,

    periodStart: meeting.meetingDate,
    periodEnd: meeting.meetingDate,

    supportEvaluations: meeting.goalEvaluations.map((ge) => ({
      methodDescription: ge.goalText,
      achievementLevel: levelMap[ge.achievementLevel] ?? 'not_observed',
      comment: ge.comment,
    })),

    environmentFindings: [],

    effectiveSupports: '',
    difficultiesObserved: '',
    newTriggers: [],
    medicalSafetyNotes: '',

    userFeedback: meeting.userFeedback,
    familyFeedback: meeting.familyFeedback,

    recommendedChanges: meeting.decisions,
    summary: meeting.overallAssessment,

    recordedBy: meeting.recordedBy,
    recordedAt: meeting.recordedAt,
  };
}
