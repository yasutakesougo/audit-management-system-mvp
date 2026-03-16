/**
 * リスクスコアリング — Pure Function
 *
 * @description
 * Phase 2-A（alertRules）と Phase 2-B（detectRepeatingPatterns）の結果を
 * 利用者単位の数値スコアに統合する。
 *
 * スコアの目的:
 * - 朝会・夕会で「今日誰に注目すべきか」を定量で示す
 * - 管理者が優先度判断に使える
 * - Phase 3 の LLM 要約の入力として使える
 *
 * 設計方針:
 * - alertRules / detectRepeatingPatterns を再利用（ロジック二重実装しない）
 * - スコアは 0-100 で正規化
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 */

import type { HandoffRecord } from './analysisTypes';
import {
  evaluateAlertRules,
  type AlertSeverity,
  type EvaluateAlertRulesOptions,
  type TriggeredAlert,
} from './alertRules';
import {
  detectRepeatingPatterns,
  type DetectRepeatingPatternsOptions,
  type RepeatingPattern,
} from './detectRepeatingPatterns';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface UserRiskScore {
  /** 利用者コード */
  userCode: string;
  /** 利用者表示名 */
  userDisplayName: string;
  /** 総合リスクスコア (0-100) */
  score: number;
  /** リスクレベル */
  level: RiskLevel;
  /** スコア内訳 */
  breakdown: {
    /** アラート由来のスコア (0-50) */
    alertScore: number;
    /** パターン由来のスコア (0-30) */
    patternScore: number;
    /** 件数由来のスコア (0-20) */
    volumeScore: number;
  };
  /** 発火したアラート */
  alerts: TriggeredAlert[];
  /** 検出されたパターン */
  patterns: RepeatingPattern[];
  /** 関連する申し送り件数 */
  totalHandoffs: number;
  /** 推奨アクション（最優先のもの） */
  topSuggestion: string;
}

export interface RiskScoringResult {
  /** スコア降順のユーザーリスクスコア一覧 */
  scores: UserRiskScore[];
  /** リスクレベル別カウント */
  byLevel: Record<RiskLevel, number>;
  /** 全体の平均スコア */
  averageScore: number;
  /** 評価対象利用者数 */
  totalUsersEvaluated: number;
}

export interface ComputeRiskScoresOptions {
  /** 基準日（テスト用） */
  baseDate?: Date;
  /** alertRules のオプション */
  alertOptions?: Omit<EvaluateAlertRulesOptions, 'baseDate'>;
  /** detectRepeatingPatterns のオプション */
  patternOptions?: Omit<DetectRepeatingPatternsOptions, 'baseDate'>;
}

// ────────────────────────────────────────────────────────────
// スコア計算ロジック
// ────────────────────────────────────────────────────────────

/** アラート severity → 加算ポイント (最大 50) */
const ALERT_SEVERITY_POINTS: Record<AlertSeverity, number> = {
  info: 3,
  warning: 8,
  alert: 15,
  critical: 25,
};

/**
 * アラートからのスコア算出 (0-50)
 */
function computeAlertScore(alerts: TriggeredAlert[]): number {
  let score = 0;
  for (const a of alerts) {
    score += ALERT_SEVERITY_POINTS[a.severity];
  }
  return Math.min(score, 50);
}

/**
 * パターンからのスコア算出 (0-30)
 *
 * - high confidence: +10
 * - medium confidence: +5
 * - low confidence: +2
 * - consecutive-days bonus: +consecutiveDays × 2
 */
function computePatternScore(patterns: RepeatingPattern[]): number {
  let score = 0;
  for (const p of patterns) {
    switch (p.confidence) {
      case 'high': score += 10; break;
      case 'medium': score += 5; break;
      case 'low': score += 2; break;
    }
    // 連続日ボーナス
    if (p.consecutiveDays && p.consecutiveDays >= 2) {
      score += p.consecutiveDays * 2;
    }
  }
  return Math.min(score, 30);
}

/**
 * 件数からのスコア算出 (0-20)
 *
 * 件数が多い → 注目度が高い（対数スケール）
 */
function computeVolumeScore(handoffCount: number): number {
  if (handoffCount <= 0) return 0;
  // log2(count) × 4 で 5件→9, 10件→13, 20件→17, 50件→22 → clamp 20
  const raw = Math.log2(handoffCount) * 4;
  return Math.min(Math.round(raw), 20);
}

/**
 * スコアからリスクレベルを判定
 */
function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return 'critical';
  if (score >= 35) return 'high';
  if (score >= 15) return 'moderate';
  return 'low';
}

/**
 * 最優先の推奨アクションを選出
 */
function pickTopSuggestion(alerts: TriggeredAlert[], patterns: RepeatingPattern[]): string {
  // アラートから最も深刻なものを選ぶ
  if (alerts.length > 0) {
    // alerts は severity 降順でソート済み
    return alerts[0].suggestion;
  }

  // パターンから推奨
  if (patterns.length > 0) {
    const top = patterns[0];
    if (top.type === 'unresolved-repeat') return '未対応案件の対応を推奨します';
    if (top.type === 'consecutive-days') return '連続傾向の確認を推奨します';
    if (top.type === 'same-timeband-repeat') return '時間帯別の対応策を検討してください';
    return '繰り返しパターンの確認を推奨します';
  }

  return '特に緊急の対応は不要です';
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * 利用者別のリスクスコアを算出する。
 *
 * @param records 分析対象の申し送りレコード
 * @param options スコアリングオプション
 * @returns リスクスコア結果（スコア降順）
 *
 * @example
 * ```ts
 * const result = computeRiskScores(records);
 * // result.scores[0] → { userCode: 'U001', score: 65, level: 'critical', ... }
 * ```
 */
export function computeRiskScores(
  records: HandoffRecord[],
  options?: ComputeRiskScoresOptions,
): RiskScoringResult {
  const baseDate = options?.baseDate ?? new Date();

  if (records.length === 0) {
    return {
      scores: [],
      byLevel: { low: 0, moderate: 0, high: 0, critical: 0 },
      averageScore: 0,
      totalUsersEvaluated: 0,
    };
  }

  // Phase 2-A: アラート評価
  const alertResult = evaluateAlertRules(records, {
    ...options?.alertOptions,
    baseDate,
  });

  // Phase 2-B: パターン検出
  const allPatterns = detectRepeatingPatterns(records, {
    ...options?.patternOptions,
    baseDate,
  });

  // 利用者別にグループ化
  const userRecordCounts = new Map<string, { count: number; displayName: string }>();
  for (const r of records) {
    if (!r.userCode || r.userCode.trim() === '') continue;
    const entry = userRecordCounts.get(r.userCode);
    if (entry) {
      entry.count++;
      // 最新のdisplayNameを使う
      if (r.createdAt > '') entry.displayName = r.userDisplayName;
    } else {
      userRecordCounts.set(r.userCode, { count: 1, displayName: r.userDisplayName });
    }
  }

  // アラート・パターンを利用者別に振り分け
  const userAlerts = new Map<string, TriggeredAlert[]>();
  for (const alert of alertResult.alerts) {
    const list = userAlerts.get(alert.userCode);
    if (list) list.push(alert);
    else userAlerts.set(alert.userCode, [alert]);
  }

  const userPatterns = new Map<string, RepeatingPattern[]>();
  for (const pattern of allPatterns) {
    const list = userPatterns.get(pattern.userCode);
    if (list) list.push(pattern);
    else userPatterns.set(pattern.userCode, [pattern]);
  }

  // 全利用者のスコアを算出
  const scores: UserRiskScore[] = [];

  for (const [userCode, { count, displayName }] of userRecordCounts) {
    const alerts = userAlerts.get(userCode) ?? [];
    const patterns = userPatterns.get(userCode) ?? [];

    const alertScore = computeAlertScore(alerts);
    const patternScore = computePatternScore(patterns);
    const volumeScore = computeVolumeScore(count);
    const totalScore = Math.min(alertScore + patternScore + volumeScore, 100);

    scores.push({
      userCode,
      userDisplayName: displayName,
      score: totalScore,
      level: scoreToLevel(totalScore),
      breakdown: {
        alertScore,
        patternScore,
        volumeScore,
      },
      alerts,
      patterns,
      totalHandoffs: count,
      topSuggestion: pickTopSuggestion(alerts, patterns),
    });
  }

  // スコア降順 → userCode 昇順
  scores.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.userCode.localeCompare(b.userCode);
  });

  // サマリー
  const byLevel: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
  let totalScoreSum = 0;
  for (const s of scores) {
    byLevel[s.level]++;
    totalScoreSum += s.score;
  }

  return {
    scores,
    byLevel,
    averageScore: scores.length > 0 ? Math.round(totalScoreSum / scores.length) : 0,
    totalUsersEvaluated: scores.length,
  };
}
