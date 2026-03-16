/**
 * evaluateGoalProgress.ts — モニタリング結果に基づく目標達成度評価 + 改定ドラフト生成
 *
 * @description
 * BehaviorMonitoringRecord の supportEvaluations を評価し、
 * 支援計画の改定必要性を判定し、改定ドラフトを生成する。
 *
 * 6層モデル: 第6層（検証: モニタリング） → 第4層（計画: 改定ドラフト）
 *
 * 設計方針:
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 * - behaviorMonitoring.ts の型を活用
 * - 改定ドラフトは buildImportPreview() と同様の差分構造で出力
 */

import type {
  BehaviorMonitoringRecord,
  BehaviorAchievementLevel,
} from '../../../domain/isp/behaviorMonitoring';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

/** 改定推奨レベル */
export type RevisionLevel = 'maintain' | 'adjust' | 'revise';

/** 1つの支援方法の評価結果 */
export interface MethodProgress {
  /** 支援方法の内容 */
  method: string;
  /** 達成度 */
  achievementLevel: BehaviorAchievementLevel;
  /** コメント */
  comment: string;
  /** 有効度スコア (0-100) */
  effectivenessScore: number;
}

/** 目標達成度の全体評価 */
export interface GoalProgressResult {
  /** 各支援方法の進捗 */
  methodProgress: MethodProgress[];
  /** 全体の有効度スコア (0-100) */
  overallScore: number;
  /** 有効な支援方法数 */
  effectiveCount: number;
  /** 効果なし/見直し必要数 */
  ineffectiveCount: number;
  /** 未観察数 */
  notObservedCount: number;
  /** 改定推奨レベル */
  revisionLevel: RevisionLevel;
  /** 改定推奨の理由 */
  revisionReason: string;
}

/** 改定ドラフトのフィールド項目 */
export interface RevisionDraftItem {
  /** 対象フィールドキー */
  fieldKey: string;
  /** 表示用フィールド名 */
  fieldLabel: string;
  /** セクション */
  section: string;
  /** 変更種別 */
  changeType: 'keep' | 'modify' | 'add' | 'remove';
  /** 現在値 */
  currentValue: string;
  /** 提案値 */
  proposedValue: string;
  /** 変更理由 */
  reason: string;
}

/** 改定ドラフト全体 */
export interface RevisionDraft {
  /** 利用者コード */
  userId: string;
  /** 対象の支援計画シートID */
  planningSheetId: string;
  /** 改定推奨レベル */
  revisionLevel: RevisionLevel;
  /** ドラフト項目 */
  items: RevisionDraftItem[];
  /** サマリー */
  summary: string;
  /** モニタリング期間 */
  monitoringPeriod: { start: string; end: string };
  /** 生成日時 */
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────
// 内部ロジック
// ────────────────────────────────────────────────────────────

/** 達成度 → 数値スコア */
const ACHIEVEMENT_SCORE: Record<BehaviorAchievementLevel, number> = {
  effective: 100,
  mostly_effective: 75,
  partial: 50,
  not_effective: 20,
  not_observed: 0,
};

/** 達成度 → 日本語ラベル（直接定義で import 循環回避） */
const ACHIEVEMENT_LABEL: Record<BehaviorAchievementLevel, string> = {
  effective: '有効',
  mostly_effective: '概ね有効',
  partial: '一部有効',
  not_effective: '効果なし',
  not_observed: '未観察',
};

/**
 * 全体スコアから改定推奨レベルを判定
 */
function scoreToRevisionLevel(score: number, ineffectiveRatio: number): RevisionLevel {
  if (score >= 70 && ineffectiveRatio <= 0.1) return 'maintain';
  if (score >= 40 || ineffectiveRatio <= 0.3) return 'adjust';
  return 'revise';
}

/**
 * 改定推奨の理由文を生成
 */
function buildRevisionReason(
  revisionLevel: RevisionLevel,
  overallScore: number,
  effectiveCount: number,
  ineffectiveCount: number,
  totalEvaluated: number,
): string {
  switch (revisionLevel) {
    case 'maintain':
      return `支援方法の${effectiveCount}/${totalEvaluated}項目が有効です（スコア${overallScore}）。現行計画の継続を推奨します`;
    case 'adjust':
      return `効果が不十分な項目が${ineffectiveCount}件あります（スコア${overallScore}）。部分的な調整を推奨します`;
    case 'revise':
      return `効果なしが${ineffectiveCount}/${totalEvaluated}項目です（スコア${overallScore}）。計画の根本的な見直しを推奨します`;
  }
}

// ────────────────────────────────────────────────────────────
// エントリ関数 1: 目標達成度評価
// ────────────────────────────────────────────────────────────

/**
 * モニタリング結果から目標達成度を評価する。
 *
 * @param monitoring - 行動モニタリング記録
 * @returns 目標達成度の評価結果
 */
export function evaluateGoalProgress(monitoring: BehaviorMonitoringRecord): GoalProgressResult {
  const evaluations = monitoring.supportEvaluations;

  if (evaluations.length === 0) {
    return {
      methodProgress: [],
      overallScore: 0,
      effectiveCount: 0,
      ineffectiveCount: 0,
      notObservedCount: 0,
      revisionLevel: 'revise',
      revisionReason: 'モニタリング評価項目が0件です。支援方法の設定を見直してください',
    };
  }

  // 各支援方法の進捗
  const methodProgress: MethodProgress[] = evaluations.map(e => ({
    method: e.methodDescription,
    achievementLevel: e.achievementLevel,
    comment: e.comment,
    effectivenessScore: ACHIEVEMENT_SCORE[e.achievementLevel],
  }));

  // カウント（not_observed は除外してスコア計算）
  const scored = methodProgress.filter(m => m.achievementLevel !== 'not_observed');
  const effectiveCount = scored.filter(m => m.effectivenessScore >= 75).length;
  const ineffectiveCount = scored.filter(m => m.effectivenessScore <= 20).length;
  const notObservedCount = methodProgress.filter(m => m.achievementLevel === 'not_observed').length;

  // 全体スコア（not_observed を除外して計算）
  const overallScore = scored.length > 0
    ? Math.round(scored.reduce((sum, m) => sum + m.effectivenessScore, 0) / scored.length)
    : 0;

  const ineffectiveRatio = scored.length > 0 ? ineffectiveCount / scored.length : 1;
  const revisionLevel = scoreToRevisionLevel(overallScore, ineffectiveRatio);
  const revisionReason = buildRevisionReason(revisionLevel, overallScore, effectiveCount, ineffectiveCount, scored.length);

  return {
    methodProgress,
    overallScore,
    effectiveCount,
    ineffectiveCount,
    notObservedCount,
    revisionLevel,
    revisionReason,
  };
}

// ────────────────────────────────────────────────────────────
// エントリ関数 2: 改定ドラフト生成
// ────────────────────────────────────────────────────────────

/**
 * モニタリング結果から支援計画の改定ドラフトを生成する。
 *
 * @param monitoring - 行動モニタリング記録
 * @param progress - evaluateGoalProgress() の結果
 * @param options - オプション
 * @returns 改定ドラフト
 */
export function buildRevisionDraft(
  monitoring: BehaviorMonitoringRecord,
  progress: GoalProgressResult,
  options?: { baseDate?: Date },
): RevisionDraft {
  const now = (options?.baseDate ?? new Date()).toISOString();
  const items: RevisionDraftItem[] = [];

  // ── 支援方法の改定提案（§5 予防的支援 / §6 代替行動） ──
  for (const mp of progress.methodProgress) {
    if (mp.achievementLevel === 'not_observed') continue;

    if (mp.effectivenessScore <= 20) {
      // 効果なし → 修正提案
      items.push({
        fieldKey: 'preSupport',
        fieldLabel: '事前支援',
        section: '§5 予防的支援',
        changeType: 'modify',
        currentValue: mp.method,
        proposedValue: `【見直し】${mp.method} — ${mp.comment || '効果が確認されていません'}`,
        reason: `モニタリング結果: ${ACHIEVEMENT_LABEL[mp.achievementLevel]}`,
      });
    } else if (mp.effectivenessScore >= 75) {
      // 有効 → 継続
      items.push({
        fieldKey: 'preSupport',
        fieldLabel: '事前支援',
        section: '§5 予防的支援',
        changeType: 'keep',
        currentValue: mp.method,
        proposedValue: mp.method,
        reason: `モニタリング結果: ${ACHIEVEMENT_LABEL[mp.achievementLevel]} — 継続推奨`,
      });
    } else {
      // 一部有効 → 調整
      items.push({
        fieldKey: 'preSupport',
        fieldLabel: '事前支援',
        section: '§5 予防的支援',
        changeType: 'modify',
        currentValue: mp.method,
        proposedValue: `【調整】${mp.method} — ${mp.comment || '部分的に有効、調整が必要'}`,
        reason: `モニタリング結果: ${ACHIEVEMENT_LABEL[mp.achievementLevel]}`,
      });
    }
  }

  // ── 環境調整の反映（§5） ──
  for (const ef of monitoring.environmentFindings) {
    items.push({
      fieldKey: 'environmentalAdjustment',
      fieldLabel: '環境調整',
      section: '§5 予防的支援',
      changeType: ef.wasEffective ? 'keep' : 'modify',
      currentValue: ef.adjustment,
      proposedValue: ef.wasEffective
        ? ef.adjustment
        : `【見直し】${ef.adjustment} — ${ef.comment || '効果が不十分'}`,
      reason: ef.wasEffective
        ? '環境調整が有効 — 継続推奨'
        : '環境調整が不十分 — 見直し推奨',
    });
  }

  // ── 新規トリガーの追記（§3 氷山分析） ──
  if (monitoring.newTriggers.length > 0) {
    items.push({
      fieldKey: 'triggers',
      fieldLabel: 'トリガー（きっかけ）',
      section: '§3 氷山分析',
      changeType: 'add',
      currentValue: '',
      proposedValue: `【モニタリングで発見】${monitoring.newTriggers.join('、')}`,
      reason: 'モニタリング期間中に新たに発見されたトリガー',
    });
  }

  // ── 困難場面の追記（§2 対象行動） ──
  if (monitoring.difficultiesObserved.trim()) {
    items.push({
      fieldKey: 'behaviorSituation',
      fieldLabel: '発生場面',
      section: '§2 対象行動',
      changeType: 'add',
      currentValue: '',
      proposedValue: `【モニタリング所見】${monitoring.difficultiesObserved}`,
      reason: 'モニタリング期間中の困難場面の観察',
    });
  }

  // ── 医療安全メモ（§8 危機対応） ──
  if (monitoring.medicalSafetyNotes.trim()) {
    items.push({
      fieldKey: 'medicalCoordination',
      fieldLabel: '医療連携',
      section: '§8 危機対応',
      changeType: 'add',
      currentValue: '',
      proposedValue: `【モニタリング所見】${monitoring.medicalSafetyNotes}`,
      reason: 'モニタリング期間中の医療・安全面の追記',
    });
  }

  // ── モニタリング指標の見直し提案（§9） ──
  if (progress.notObservedCount > 0 && progress.methodProgress.length > 0) {
    const notObservedRatio = progress.notObservedCount / progress.methodProgress.length;
    if (notObservedRatio >= 0.3) {
      items.push({
        fieldKey: 'evaluationIndicator',
        fieldLabel: '評価指標',
        section: '§9 モニタリング',
        changeType: 'modify',
        currentValue: '',
        proposedValue: `【指標見直し】${progress.notObservedCount}項目が未観察です。評価指標を観察可能な形に見直してください`,
        reason: `未観察率 ${Math.round(notObservedRatio * 100)}% — 指標が観察困難な可能性`,
      });
    }
  }

  // サマリー
  const levelLabel = progress.revisionLevel === 'maintain' ? '継続'
    : progress.revisionLevel === 'adjust' ? '部分調整'
    : '根本見直し';
  const summary = `モニタリング結果に基づく改定ドラフト（${levelLabel}）: ${items.filter(i => i.changeType !== 'keep').length}件の変更提案`;

  return {
    userId: monitoring.userId,
    planningSheetId: monitoring.planningSheetId,
    revisionLevel: progress.revisionLevel,
    items,
    summary,
    monitoringPeriod: {
      start: monitoring.periodStart,
      end: monitoring.periodEnd,
    },
    generatedAt: now,
  };
}
