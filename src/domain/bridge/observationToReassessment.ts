/**
 * observationToReassessment — Observation → Reassessment ブリッジ
 *
 * 純関数: 観察データ + 手順実施記録 + 支援計画シート から
 * 再評価ドラフトを自動生成する。
 *
 * PDCA の Check → Act を自動化する核心ロジック。
 *
 * ── フロー ──
 *
 * WeeklyObservationRecord[]  ─┐
 * SupportProcedureRecord[]   ─┤→ buildReassessmentDraft() → PlanningSheetReassessmentDraft
 * PlanningSheet(metadata)    ─┘
 *
 * ── 設計判断 ──
 *
 * - UI 非依存の純関数。テスト容易。
 * - 自然言語サマリーは決定的テンプレート方式（LLM不要）。
 * - 判定ロジックは閾値ベース（将来的に ML 移行可能な設計）。
 *
 * @module domain/bridge/observationToReassessment
 */

import type { WeeklyObservationRecord } from '@/domain/regulatory/weeklyObservation';
import type { SupportProcedureRecord } from '@/domain/isp/schema';
import type {
  PlanningSheetReassessment,
  ReassessmentTrigger,
  PlanChangeDecision,
} from '@/domain/isp/planningSheetReassessment';
import { DEFAULT_REASSESSMENT_CYCLE_DAYS } from '@/domain/isp/planningSheetReassessment';

// ─────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────

/** ブリッジへの入力: 支援計画シートの最低限のメタデータ */
export interface PlanningSheetContext {
  /** 支援計画シート ID */
  planningSheetId: string;
  /** 利用者 ID */
  userId: string;
  /** 対象場面（ある場合） */
  targetScene?: string;
  /** 仮説テキスト（ある場合） */
  hypothesisText?: string;
  /** 最終再評価日 */
  lastReassessmentAt?: string | null;
  /** 再評価周期（日） */
  reassessmentCycleDays?: number;
}

/** ブリッジの出力: 再評価ドラフト（ID・日付は呼び出し側で注入） */
export interface ReassessmentDraft {
  /** 紐づく支援計画シート ID */
  planningSheetId: string;

  // ── 自動判定 ──

  /** 推奨トリガー種別 */
  suggestedTrigger: ReassessmentTrigger;
  /** 推奨計画変更判定 */
  suggestedDecision: PlanChangeDecision;
  /** 推奨理由（自動生成テキスト） */
  suggestedReason: string;

  // ── 集約サマリー（初期値として使用） ──

  /** ABC記録のまとめ */
  abcSummary: string;
  /** 仮説の検証結果 */
  hypothesisReview: string;
  /** 手順の実効性評価 */
  procedureEffectiveness: string;
  /** 環境変化の記録 */
  environmentChange: string;

  // ── 統計情報 ──

  /** 分析期間（ISO 8601 日付） */
  analysisRange: { from: string; to: string };
  /** 観察記録数 */
  observationCount: number;
  /** 手順実施記録数 */
  procedureRecordCount: number;
  /** 手順実施率 */
  procedureCompletionRate: number;
  /** 観察内容の頻度分析（キーワード → 出現数） */
  observationThemes: Array<{ theme: string; count: number }>;
  /** 手順不全スコア（0-1, 高いほど問題あり） */
  procedureGapScore: number;
}

// ─────────────────────────────────────────────
// Analysis helpers (pure)
// ─────────────────────────────────────────────

/** 手順実施率を算出 */
function computeCompletionRate(records: SupportProcedureRecord[]): number {
  if (records.length === 0) return 1;
  const done = records.filter((r) => r.executionStatus === 'done').length;
  return done / records.length;
}

/** 手順不全スコアを算出 (0-1) */
function computeProcedureGapScore(records: SupportProcedureRecord[]): number {
  if (records.length === 0) return 0;
  const problematic = records.filter(
    (r) => r.executionStatus === 'skipped' || r.executionStatus === 'partially_done',
  ).length;
  return problematic / records.length;
}

/**
 * 観察内容からテーマを抽出（キーワードベース）
 *
 * 将来的には NLP ベースに拡張可能。
 * 現在は福祉現場でよく使われるキーワードの出現頻度を集計。
 */
const THEME_KEYWORDS: Array<{ theme: string; keywords: string[] }> = [
  { theme: '行動増加', keywords: ['増加', '頻繁', '多い', '増えて'] },
  { theme: '行動減少', keywords: ['減少', '少ない', '収ま', '落ち着'] },
  { theme: '環境変化', keywords: ['環境', '変化', '移動', '部屋', '日課'] },
  { theme: '手順不全', keywords: ['手順', '実行でき', 'うまくいか', '効果なし'] },
  { theme: 'リスク行動', keywords: ['危険', 'リスク', '自傷', '他害', '離席', '逸脱'] },
  { theme: '肯定的変化', keywords: ['改善', '成功', '笑顔', '安定', '意欲', '自発'] },
  { theme: 'コミュニケーション', keywords: ['表出', '伝え', '要求', 'サイン', '絵カード', 'PECS'] },
  { theme: '服薬・健康', keywords: ['服薬', '体調', '睡眠', '食欲', '排泄'] },
];

function extractThemes(observations: WeeklyObservationRecord[]): Array<{ theme: string; count: number }> {
  const counts = new Map<string, number>();

  const allText = observations
    .map((o) => `${o.observationContent} ${o.adviceContent} ${o.followUpActions}`)
    .join(' ');

  for (const { theme, keywords } of THEME_KEYWORDS) {
    let count = 0;
    for (const kw of keywords) {
      // 単純な出現回数カウント
      const regex = new RegExp(kw, 'gi');
      const matches = allText.match(regex);
      if (matches) count += matches.length;
    }
    if (count > 0) {
      counts.set(theme, count);
    }
  }

  return Array.from(counts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

/** 分析期間を算出 */
function computeAnalysisRange(
  observations: WeeklyObservationRecord[],
  procedures: SupportProcedureRecord[],
): { from: string; to: string } {
  const allDates = [
    ...observations.map((o) => o.observationDate),
    ...procedures.map((p) => p.recordDate),
  ].filter(Boolean).sort();

  if (allDates.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today, to: today };
  }

  return { from: allDates[0], to: allDates[allDates.length - 1] };
}

// ─────────────────────────────────────────────
// Trigger / Decision inference (pure)
// ─────────────────────────────────────────────

interface InferenceResult {
  trigger: ReassessmentTrigger;
  decision: PlanChangeDecision;
  reason: string;
}

function inferTriggerAndDecision(
  context: PlanningSheetContext,
  observations: WeeklyObservationRecord[],
  gapScore: number,
  themes: Array<{ theme: string; count: number }>,
  completionRate: number,
  referenceDate?: string,
): InferenceResult {
  const cycleDays = context.reassessmentCycleDays ?? DEFAULT_REASSESSMENT_CYCLE_DAYS;
  const now = referenceDate ?? new Date().toISOString().slice(0, 10);

  // ── 定期見直し超過チェック ──
  if (context.lastReassessmentAt) {
    const last = new Date(context.lastReassessmentAt);
    const ref = new Date(now);
    const daysSince = Math.floor((ref.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= cycleDays) {
      return {
        trigger: 'scheduled',
        decision: gapScore > 0.3 ? 'major_revision' : 'minor_revision',
        reason: `最終再評価から${daysSince}日経過（周期: ${cycleDays}日）。定期見直しが必要です。`,
      };
    }
  } else if (observations.length > 0) {
    // 再評価未実施かつ観察あり → 初回再評価
    return {
      trigger: 'scheduled',
      decision: 'minor_revision',
      reason: '再評価がまだ実施されていません。初回の再評価をおすすめします。',
    };
  }

  // ── リスク行動検出 ──
  const riskTheme = themes.find((t) => t.theme === 'リスク行動');
  if (riskTheme && riskTheme.count >= 3) {
    return {
      trigger: 'incident',
      decision: riskTheme.count >= 5 ? 'urgent_revision' : 'major_revision',
      reason: `リスク行動に関する記録が${riskTheme.count}件検出されました。計画の見直しを検討してください。`,
    };
  }

  // ── 手順不全 ──
  if (gapScore > 0.3) {
    return {
      trigger: 'monitoring',
      decision: gapScore > 0.5 ? 'major_revision' : 'minor_revision',
      reason: `手順実施率が${(completionRate * 100).toFixed(0)}%です（不全スコア: ${(gapScore * 100).toFixed(0)}%）。手順の見直しを検討してください。`,
    };
  }

  // ── 行動増加 ──
  const increaseTheme = themes.find((t) => t.theme === '行動増加');
  if (increaseTheme && increaseTheme.count >= 3) {
    return {
      trigger: 'incident',
      decision: 'minor_revision',
      reason: `行動増加に関する記録が${increaseTheme.count}件あります。仮説の再検証をおすすめします。`,
    };
  }

  // ── 問題なし ──
  return {
    trigger: 'scheduled',
    decision: 'no_change',
    reason: '現時点で大きな問題は検出されていません。',
  };
}

// ─────────────────────────────────────────────
// Summary generators (pure, template-based)
// ─────────────────────────────────────────────

function generateAbcSummary(
  observations: WeeklyObservationRecord[],
  themes: Array<{ theme: string; count: number }>,
): string {
  if (observations.length === 0) return '分析対象の観察記録がありません。';

  const lines: string[] = [`分析期間の観察記録: ${observations.length}件`];

  if (themes.length > 0) {
    lines.push('');
    lines.push('検出されたテーマ:');
    for (const { theme, count } of themes.slice(0, 5)) {
      lines.push(`  • ${theme}: ${count}件`);
    }
  }

  // 直近3件の観察内容
  const recent = observations
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate))
    .slice(0, 3);

  if (recent.length > 0) {
    lines.push('');
    lines.push('直近の観察:');
    for (const o of recent) {
      lines.push(`  [${o.observationDate}] ${o.observationContent.slice(0, 100)}`);
    }
  }

  return lines.join('\n');
}

function generateHypothesisReview(
  context: PlanningSheetContext,
  themes: Array<{ theme: string; count: number }>,
): string {
  const lines: string[] = [];

  if (context.hypothesisText) {
    lines.push(`現行仮説: ${context.hypothesisText}`);
    lines.push('');
  }

  const positive = themes.find((t) => t.theme === '肯定的変化');
  const negative = themes.find((t) => t.theme === '行動増加');
  const risk = themes.find((t) => t.theme === 'リスク行動');

  if (positive) {
    lines.push(`✅ 肯定的変化: ${positive.count}件の記録あり — 仮説が支持されている可能性があります。`);
  }
  if (negative) {
    lines.push(`⚠ 行動増加: ${negative.count}件の記録あり — 仮説の修正を検討してください。`);
  }
  if (risk) {
    lines.push(`🚨 リスク行動: ${risk.count}件の記録あり — 仮説の再検証が必要です。`);
  }
  if (!positive && !negative && !risk) {
    lines.push('特筆すべき傾向は検出されませんでした。');
  }

  return lines.join('\n');
}

function generateProcedureEffectiveness(
  records: SupportProcedureRecord[],
  completionRate: number,
  gapScore: number,
): string {
  if (records.length === 0) return '分析対象の手順実施記録がありません。';

  const lines: string[] = [
    `手順実施記録: ${records.length}件`,
    `実施完了率: ${(completionRate * 100).toFixed(0)}%`,
  ];

  if (gapScore > 0.3) {
    lines.push(`⚠ 手順不全スコア: ${(gapScore * 100).toFixed(0)}% — 手順の見直しが必要です。`);
  } else if (gapScore > 0.1) {
    lines.push(`△ 手順不全スコア: ${(gapScore * 100).toFixed(0)}% — 一部改善の余地があります。`);
  } else {
    lines.push(`✅ 手順は概ね正常に機能しています。`);
  }

  // skipped の理由サンプル
  const skipped = records
    .filter((r) => r.executionStatus === 'skipped')
    .slice(0, 3);
  if (skipped.length > 0) {
    lines.push('');
    lines.push('未実施記録のサンプル:');
    for (const s of skipped) {
      const note = s.specialNotes || s.handoffNotes || '(理由なし)';
      lines.push(`  [${s.recordDate}] ${note.slice(0, 80)}`);
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Main bridge function (pure)
// ─────────────────────────────────────────────

/**
 * 観察・手順データから再評価ドラフトを自動生成する。
 *
 * ## 使い方
 *
 * ```ts
 * const draft = buildReassessmentDraft({
 *   context: { planningSheetId: 'ps-1', userId: 'u-1' },
 *   observations,
 *   procedureRecords,
 * });
 *
 * // → Reassessment 画面の初期値として使う
 * ```
 *
 * @param params - 入力データ
 * @param referenceDate - 基準日（テスト用）
 * @returns 再評価ドラフト
 */
export function buildReassessmentDraft(params: {
  context: PlanningSheetContext;
  observations: WeeklyObservationRecord[];
  procedureRecords: SupportProcedureRecord[];
  referenceDate?: string;
}): ReassessmentDraft {
  const { context, observations, procedureRecords, referenceDate } = params;

  // ── 利用者の記録をフィルタ ──
  const userObs = observations.filter((o) => o.userId === context.userId);
  const userProcs = procedureRecords.filter(
    (p) => p.planningSheetId === context.planningSheetId,
  );

  // ── 集計 ──
  const completionRate = computeCompletionRate(userProcs);
  const gapScore = computeProcedureGapScore(userProcs);
  const themes = extractThemes(userObs);
  const analysisRange = computeAnalysisRange(userObs, userProcs);

  // ── 推論 ──
  const inference = inferTriggerAndDecision(
    context,
    userObs,
    gapScore,
    themes,
    completionRate,
    referenceDate,
  );

  // ── サマリー生成 ──
  const abcSummary = generateAbcSummary(userObs, themes);
  const hypothesisReview = generateHypothesisReview(context, themes);
  const procedureEffectiveness = generateProcedureEffectiveness(userProcs, completionRate, gapScore);

  return {
    planningSheetId: context.planningSheetId,
    suggestedTrigger: inference.trigger,
    suggestedDecision: inference.decision,
    suggestedReason: inference.reason,
    abcSummary,
    hypothesisReview,
    procedureEffectiveness,
    environmentChange: '', // 環境変化は手動入力（自動推論が困難）
    analysisRange,
    observationCount: userObs.length,
    procedureRecordCount: userProcs.length,
    procedureCompletionRate: completionRate,
    observationThemes: themes,
    procedureGapScore: gapScore,
  };
}

/**
 * ReassessmentDraft → PlanningSheetReassessment を変換する。
 *
 * ID・日付・実施者は呼び出し側が注入。
 */
export function draftToReassessment(
  draft: ReassessmentDraft,
  params: {
    id: string;
    reassessedAt: string;
    reassessedBy: string;
    nextReassessmentAt?: string;
    notes?: string;
  },
): PlanningSheetReassessment {
  const cycleDays = DEFAULT_REASSESSMENT_CYCLE_DAYS;
  const nextDate = params.nextReassessmentAt ??
    (() => {
      const d = new Date(params.reassessedAt);
      d.setDate(d.getDate() + cycleDays);
      return d.toISOString().slice(0, 10);
    })();

  return {
    id: params.id,
    planningSheetId: draft.planningSheetId,
    reassessedAt: params.reassessedAt,
    reassessedBy: params.reassessedBy,
    triggerType: draft.suggestedTrigger,
    abcSummary: draft.abcSummary,
    hypothesisReview: draft.hypothesisReview,
    procedureEffectiveness: draft.procedureEffectiveness,
    environmentChange: draft.environmentChange,
    planChangeDecision: draft.suggestedDecision,
    nextReassessmentAt: nextDate,
    notes: params.notes ?? '',
  };
}
