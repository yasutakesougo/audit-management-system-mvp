/**
 * reassessmentSignals — Monitoring → Reassessment 中間変換
 *
 * MonitoringEvidenceSummary から「再評価の論点（Signal）」を抽出し、
 * buildReassessmentDraft() に渡せる形にする。
 *
 * ── 設計方針 ──
 *
 * 1. 純関数 — UI・Repository 非依存
 * 2. 閾値ベースの分類 — 将来的に機械学習へ置換可能
 * 3. 推奨文は決定的テンプレート — LLM 不要
 * 4. severity は low / medium / high の3段階
 *
 * ── 変換フロー ──
 *
 * MonitoringEvidenceSummary
 *   ↓ deriveReassessmentSignals()
 * ReassessmentSignal[]
 *   ↓ signalsToReassessmentSections()
 * { currentStatus, issues, stableSupport, recommendations }
 *   ↓ buildReassessmentDraft() に注入
 *
 * @module domain/bridge/reassessmentSignals
 */

import type { MonitoringEvidenceSummary, ProcedureMonitoringSummary } from './monitoringEvidence';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SignalKind =
  | 'low_execution'
  | 'frequent_note'
  | 'high_trigger'
  | 'unrecorded_slot'
  | 'stable_success';

export type SignalSeverity = 'low' | 'medium' | 'high';

export interface ReassessmentSignal {
  kind: SignalKind;
  procedureId?: string;
  activity: string;
  summary: string;
  severity: SignalSeverity;
  evidence: {
    completionRate?: number;
    noteCount?: number;
    triggerCount?: number;
    unrecordedRate?: number;
    periodFrom: string;
    periodTo: string;
  };
  recommendation: string;
}

// ─────────────────────────────────────────────
// Signal derivation (pure)
// ─────────────────────────────────────────────

/** 低実施率シグナルの閾値 */
const LOW_EXECUTION_THRESHOLD = 0.6;
/** 高実施率（安定）の閾値 */
const STABLE_SUCCESS_THRESHOLD = 0.9;
/** 特記事項「多い」の最小件数 */
const FREQUENT_NOTE_MIN = 3;
/** BIP 発動「多い」の最小件数 */
const HIGH_TRIGGER_MIN = 2;
/** 未記録率「高い」の閾値 */
const UNRECORDED_SLOT_THRESHOLD = 0.3;

function deriveLowExecution(
  proc: ProcedureMonitoringSummary,
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal | null {
  if (proc.completionRate >= LOW_EXECUTION_THRESHOLD) return null;

  const severity: SignalSeverity =
    proc.completionRate < 0.3 ? 'high' : proc.completionRate < 0.5 ? 'medium' : 'low';

  return {
    kind: 'low_execution',
    procedureId: proc.procedureId,
    activity: proc.activity,
    summary: `「${proc.activity}」の実施率が${Math.round(proc.completionRate * 100)}%（${proc.recordedCount}/${proc.plannedCount}日）と低い状態です。`,
    severity,
    evidence: {
      completionRate: proc.completionRate,
      periodFrom: summary.from,
      periodTo: summary.to,
    },
    recommendation: severity === 'high'
      ? '手順内容の大幅な簡素化、または時間帯の変更を検討してください。現場導線との不一致の可能性があります。'
      : '手順の難易度や実施タイミングを見直してください。記録漏れの可能性も確認が必要です。',
  };
}

function deriveFrequentNote(
  proc: ProcedureMonitoringSummary,
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal | null {
  if (proc.noteCount < FREQUENT_NOTE_MIN) return null;

  const severity: SignalSeverity = proc.noteCount >= 8 ? 'high' : proc.noteCount >= 5 ? 'medium' : 'low';

  return {
    kind: 'frequent_note',
    procedureId: proc.procedureId,
    activity: proc.activity,
    summary: `「${proc.activity}」に${proc.noteCount}件の特記事項が記録されています。状況変動が大きい可能性があります。`,
    severity,
    evidence: {
      noteCount: proc.noteCount,
      periodFrom: summary.from,
      periodTo: summary.to,
    },
    recommendation: '状況変動が大きい場面のため、計画上の着眼点への明示的な反映を検討してください。観察継続も必要です。',
  };
}

function deriveHighTrigger(
  proc: ProcedureMonitoringSummary,
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal | null {
  if (proc.triggeredCount < HIGH_TRIGGER_MIN) return null;

  const severity: SignalSeverity = proc.triggeredCount >= 5 ? 'high' : proc.triggeredCount >= 3 ? 'medium' : 'low';

  return {
    kind: 'high_trigger',
    procedureId: proc.procedureId,
    activity: proc.activity,
    summary: `「${proc.activity}」で${proc.triggeredCount}回の行動発生が記録されています。予防的支援手順の追加を検討してください。`,
    severity,
    evidence: {
      triggerCount: proc.triggeredCount,
      periodFrom: summary.from,
      periodTo: summary.to,
    },
    recommendation: '予防的支援手順の追加、環境調整・先行刺激の見直し、ABC観察との接続を検討してください。',
  };
}

function deriveStableSuccess(
  proc: ProcedureMonitoringSummary,
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal | null {
  if (proc.completionRate < STABLE_SUCCESS_THRESHOLD) return null;
  if (proc.noteCount >= FREQUENT_NOTE_MIN) return null;
  if (proc.triggeredCount >= HIGH_TRIGGER_MIN) return null;

  return {
    kind: 'stable_success',
    procedureId: proc.procedureId,
    activity: proc.activity,
    summary: `「${proc.activity}」は実施率${Math.round(proc.completionRate * 100)}%と安定しており、現行支援は適切に機能しています。`,
    severity: 'low',
    evidence: {
      completionRate: proc.completionRate,
      periodFrom: summary.from,
      periodTo: summary.to,
    },
    recommendation: '現行支援の継続が妥当です。',
  };
}

function deriveUnrecordedSlots(
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal[] {
  return summary.unrecordedTimeSlots
    .filter((s) => s.unrecordedRate > UNRECORDED_SLOT_THRESHOLD)
    .map((slot) => ({
      kind: 'unrecorded_slot' as const,
      activity: `${slot.time} 時間帯`,
      summary: `${slot.time} の時間帯で未記録率が${Math.round(slot.unrecordedRate * 100)}%です。記録導線や手順粒度の見直しが必要です。`,
      severity: (slot.unrecordedRate > 0.7 ? 'high' : slot.unrecordedRate > 0.5 ? 'medium' : 'low') as SignalSeverity,
      evidence: {
        unrecordedRate: slot.unrecordedRate,
        periodFrom: summary.from,
        periodTo: summary.to,
      },
      recommendation: '記録負荷の高い時間帯のため、入力導線の見直しまたは手順粒度の再設計を検討してください。',
    }));
}

// ─────────────────────────────────────────────
// Main derivation function
// ─────────────────────────────────────────────

/**
 * MonitoringEvidenceSummary から再評価シグナルを抽出する。
 *
 * @param summary - モニタリング集計結果
 * @returns 検出されたシグナル一覧（severity 降順）
 */
export function deriveReassessmentSignals(
  summary: MonitoringEvidenceSummary,
): ReassessmentSignal[] {
  const signals: ReassessmentSignal[] = [];

  // 手順ごとのシグナル抽出
  for (const proc of summary.procedureSummaries) {
    const lowExec = deriveLowExecution(proc, summary);
    if (lowExec) signals.push(lowExec);

    const freqNote = deriveFrequentNote(proc, summary);
    if (freqNote) signals.push(freqNote);

    const highTrig = deriveHighTrigger(proc, summary);
    if (highTrig) signals.push(highTrig);

    const stable = deriveStableSuccess(proc, summary);
    if (stable) signals.push(stable);
  }

  // 時間帯シグナル
  signals.push(...deriveUnrecordedSlots(summary));

  // severity 降順ソート
  const severityOrder: Record<SignalSeverity, number> = { high: 3, medium: 2, low: 1 };
  signals.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  return signals;
}

// ─────────────────────────────────────────────
// Signal → Reassessment sections
// ─────────────────────────────────────────────

export interface ReassessmentSections {
  /** 現状の整理 */
  currentStatus: string;
  /** 課題候補 */
  issues: string;
  /** 継続すべき支援 */
  stableSupport: string;
  /** 見直し提案 */
  recommendations: string;
}

/**
 * ReassessmentSignal[] を再評価ドラフトのセクションテキストに変換する。
 *
 * @param signals - deriveReassessmentSignals() の出力
 * @param summary - 元の MonitoringEvidenceSummary
 * @returns 再評価ドラフトのセクション
 */
export function signalsToReassessmentSections(
  signals: ReassessmentSignal[],
  summary: MonitoringEvidenceSummary,
): ReassessmentSections {
  // ── 現状の整理 ──
  const statusLines: string[] = [
    `集計期間: ${summary.from} 〜 ${summary.to}（${summary.totalDays}日間）`,
    `対象手順: ${summary.totalProcedures}件`,
    `全体実施率: ${Math.round(summary.overallCompletionRate * 100)}%`,
  ];

  const highSignals = signals.filter((s) => s.severity === 'high');
  const mediumSignals = signals.filter((s) => s.severity === 'medium');
  if (highSignals.length > 0) statusLines.push(`⚠ 重要シグナル: ${highSignals.length}件`);
  if (mediumSignals.length > 0) statusLines.push(`△ 注意シグナル: ${mediumSignals.length}件`);

  // ── 課題候補 ──
  const issueSignals = signals.filter(
    (s) => s.kind === 'low_execution' || s.kind === 'high_trigger' || s.kind === 'frequent_note' || s.kind === 'unrecorded_slot',
  );
  const issueLines: string[] = issueSignals.map(
    (s) => `[${s.severity.toUpperCase()}] ${s.summary}`,
  );

  // ── 継続すべき支援 ──
  const stableSignals = signals.filter((s) => s.kind === 'stable_success');
  const stableLines: string[] = stableSignals.length > 0
    ? stableSignals.map((s) => `✅ ${s.summary}`)
    : ['安定した支援項目は特定されませんでした。'];

  // ── 見直し提案 ──
  const recSignals = signals.filter((s) => s.severity !== 'low' || s.kind !== 'stable_success');
  const recLines: string[] = recSignals.length > 0
    ? recSignals.map((s) => `• ${s.activity}: ${s.recommendation}`)
    : ['現時点で見直し提案はありません。'];

  return {
    currentStatus: statusLines.join('\n'),
    issues: issueLines.length > 0 ? issueLines.join('\n') : '現時点で課題は検出されていません。',
    stableSupport: stableLines.join('\n'),
    recommendations: recLines.join('\n'),
  };
}
