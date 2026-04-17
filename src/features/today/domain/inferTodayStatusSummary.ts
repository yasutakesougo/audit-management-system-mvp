/**
 * inferTodayStatusSummary — 既存データから一行サマリーを生成する純粋関数
 *
 * 入力: ProgressRings / Exception / Attendance の既存値
 * 出力: emoji + message + level で構成される StatusSummary
 *
 * ⚠️ 新しいデータソースは追加しない。既存の値を「翻訳」するだけ。
 * ⚠️ このモジュールは UI 層を一切参照しない。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import type { StatusDelta } from './computeStatusDelta';
import { formatDeltaText } from './computeStatusDelta';

// ─── Types ───────────────────────────────────────────────────

export type StatusLevel = 'good' | 'warning' | 'critical';

export type TodayStatusSummary = {
  /** 表示用 emoji */
  emoji: string;
  /** 一行サマリーメッセージ */
  message: string;
  /** 状態レベル（UIの色分けに使用） */
  level: StatusLevel;
  /** 補助メッセージ（例: 「先に確認：申し送り」） */
  hint?: string;
  /** 前日比テキスト（例: 「前日比 記録+4」）。delta未提供時は undefined */
  deltaText?: string;
};

export type StatusSummaryInput = {
  /** 支援手順: completed / total */
  records: { completed: number; total: number };
  /** ケース記録: completed / total */
  caseRecords: { completed: number; total: number };
  /** 出欠: present / scheduled */
  attendance: { present: number; scheduled: number };
  /** 未対応連絡件数 */
  contactCount: number;
  /** critical例外の件数 */
  criticalExceptionCount: number;
  /** high例外の件数 */
  highExceptionCount: number;
  /** 発熱者数 */
  feverCount: number;
  /** 当日欠席数 */
  sameDayAbsenceCount: number;
  /** 前日比の構造化データ（optional: 未提供時はdelta非表示） */
  delta?: StatusDelta | null;
};

// ─── Logic ───────────────────────────────────────────────────

/**
 * 既存データの意味を統合し、ステータスサマリーを生成する。
 *
 * 判定優先順位:
 * 1. critical例外 or 発熱 → 🔴 critical
 * 2. 記録遅延(残>50%) or 当日欠席あり or high例外 → ⚠️ warning
 * 3. それ以外 → ✅ good
 */
export function inferTodayStatusSummary(input: StatusSummaryInput): TodayStatusSummary {
  const {
    records,
    caseRecords,
    attendance,
    contactCount,
    criticalExceptionCount,
    highExceptionCount,
    feverCount,
    sameDayAbsenceCount,
    delta,
  } = input;

  // ── 前日比テキスト（全パスで共通利用） ──
  const deltaText = formatDeltaText(delta) ?? undefined;

  // ── 派生値の計算 ──
  const recordsRemaining = Math.max(0, records.total - records.completed);
  const caseRemaining = Math.max(0, caseRecords.total - caseRecords.completed);
  const totalRemaining = recordsRemaining + caseRemaining;

  const recordPct = records.total > 0
    ? Math.round((records.completed / records.total) * 100)
    : 100;
  const casePct = caseRecords.total > 0
    ? Math.round((caseRecords.completed / caseRecords.total) * 100)
    : 100;

  // ── Critical 判定: 即時対応が必要 ──
  if (criticalExceptionCount > 0) {
    const reasons: string[] = [];
    if (criticalExceptionCount > 0) reasons.push(`緊急対応${criticalExceptionCount}件`);
    if (feverCount > 0) reasons.push(`発熱${feverCount}名`);
    return {
      emoji: '🔴',
      message: `要注意（${reasons.join('・')}）`,
      level: 'critical',
      hint: '先に確認：申し送り',
      deltaText,
    };
  }

  if (feverCount >= 2) {
    return {
      emoji: '🔴',
      message: `要注意（発熱${feverCount}名）`,
      level: 'critical',
      hint: '看護師に確認してください',
      deltaText,
    };
  }

  // ── Warning 判定: 注意が必要 ──
  const warningReasons: string[] = [];

  // 記録が50%未満 = 遅延
  if (recordPct < 50 && records.total > 0) {
    warningReasons.push(`手順 残${recordsRemaining}件`);
  }
  if (casePct < 50 && caseRecords.total > 0) {
    warningReasons.push(`ケース 残${caseRemaining}件`);
  }

  if (sameDayAbsenceCount > 0) {
    warningReasons.push(`当日欠席${sameDayAbsenceCount}名`);
  }

  if (highExceptionCount > 0) {
    warningReasons.push(`未対応${highExceptionCount}件`);
  }

  if (feverCount === 1) {
    warningReasons.push(`発熱${feverCount}名`);
  }

  if (contactCount > 2) {
    warningReasons.push(`未対応連絡${contactCount}件`);
  }

  if (warningReasons.length > 0) {
    return {
      emoji: '⚠️',
      message: warningReasons.join('・'),
      level: 'warning',
      hint: totalRemaining > 0
        ? `記録 あと${totalRemaining}件`
        : undefined,
      deltaText,
    };
  }

  // ── Good 判定: 順調 ──
  const parts: string[] = [];

  // 記録は「残数」で表示（行動を促す）
  if (totalRemaining > 0) {
    parts.push(`記録 あと${totalRemaining}件`);
  } else {
    parts.push('記録 完了');
  }

  // 出欠
  parts.push(`出席${attendance.present}/${attendance.scheduled}`);

  const isAllComplete = totalRemaining === 0;

  return {
    emoji: isAllComplete ? '✨' : '✅',
    message: isAllComplete ? '本日の入力はすべて完了しています' : `順調（${parts.join('・')}）`,
    level: 'good',
    hint: isAllComplete ? '記録が完了しました' : undefined,
    deltaText,
  };
}
