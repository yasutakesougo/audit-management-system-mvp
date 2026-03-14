/**
 * monitoringSchedule — モニタリング期限管理
 *
 * 支援開始日（appliedFrom）を起点に、
 * reviewCycleDays に基づくモニタリング予定日を算出する。
 *
 * ── 制度根拠 ──
 * 障害者総合支援法施行規則 第26条の2:
 * 「少なくとも3か月に1回以上、モニタリングを行う」
 *
 * ── 設計方針 ──
 * 1. appliedFrom（適用開始日）を起点とする
 *    → アセスメント後の支援開始日が制度上のモニタリング起点
 * 2. reviewCycleDays（default: 90日）で周期を制御
 * 3. 最終モニタリング日（lastMonitoredAt）から次回予定を計算
 * 4. reviewedAt（最終見直し日）があればそちらを優先
 *
 * @module domain/bridge/monitoringSchedule
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type MonitoringUrgency = 'safe' | 'upcoming' | 'due' | 'overdue';

export interface MonitoringScheduleInfo {
  /** モニタリング起点日 */
  startDate: string;
  /** 見直し周期（日） */
  cycleDays: number;
  /** 最終モニタリング実施日 */
  lastMonitoredAt: string | null;
  /** 次回モニタリング予定日 */
  nextDueDate: string;
  /** 今日から次回までの残日数（マイナスは超過） */
  daysRemaining: number;
  /** 緊急度 */
  urgency: MonitoringUrgency;
  /** 今年度中のモニタリング計画一覧 */
  schedule: MonitoringMilestone[];
}

export interface MonitoringMilestone {
  /** 回目（1-indexed） */
  round: number;
  /** 予定日 */
  dueDate: string;
  /** 実施済みか */
  completed: boolean;
  /** 現在の期間内か */
  isCurrent: boolean;
}

// ─────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────

/**
 * ISO 8601 日付文字列から Date を生成（UTC ベース）。
 * 不正な場合 null を返す。
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Date を 'YYYY-MM-DD' に変換 */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 日数差を計算（a - b） */
function daysDiff(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((aUtc - bUtc) / (1000 * 60 * 60 * 24));
}

/** 緊急度を判定 */
function classifyUrgency(daysRemaining: number): MonitoringUrgency {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return 'due';
  if (daysRemaining <= 14) return 'upcoming';
  return 'safe';
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

export interface ComputeScheduleInput {
  /** 適用開始日（支援開始日） */
  appliedFrom: string;
  /** 見直し周期（日） default: 90 */
  reviewCycleDays?: number;
  /** 最終モニタリング実施日 */
  lastMonitoredAt?: string | null;
  /** 最終見直し日（再評価日） */
  reviewedAt?: string | null;
  /** 基準日（テスト用） */
  referenceDate?: string;
}

/**
 * モニタリングスケジュールを算出する。
 *
 * @returns スケジュール情報。起点日が不正な場合 null。
 */
export function computeMonitoringSchedule(
  input: ComputeScheduleInput,
): MonitoringScheduleInfo | null {
  const startDate = parseDate(input.appliedFrom);
  if (!startDate) return null;

  const cycleDays = input.reviewCycleDays ?? 90;
  const today = parseDate(input.referenceDate) ?? new Date();

  // 最終実施日: reviewedAt を優先、なければ lastMonitoredAt
  const lastDone = parseDate(input.reviewedAt) ?? parseDate(input.lastMonitoredAt);

  // 次回予定日の計算
  let nextDueDate: Date;
  if (lastDone) {
    // 最終実施日 + cycleDays
    nextDueDate = new Date(lastDone);
    nextDueDate.setDate(nextDueDate.getDate() + cycleDays);
  } else {
    // 開始日から cycleDays 後
    nextDueDate = new Date(startDate);
    nextDueDate.setDate(nextDueDate.getDate() + cycleDays);
  }

  const daysRemaining = daysDiff(nextDueDate, today);
  const urgency = classifyUrgency(daysRemaining);

  // 年間スケジュール（開始日から12か月分）
  const schedule: MonitoringMilestone[] = [];
  const endOfYear = new Date(startDate);
  endOfYear.setFullYear(endOfYear.getFullYear() + 1);

  let round = 1;
  const cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() + cycleDays);

  while (cursor <= endOfYear) {
    const dueStr = toDateStr(cursor);
    const isCompleted = lastDone !== null && daysDiff(cursor, lastDone) <= 0;
    const isCurrent = toDateStr(cursor) === toDateStr(nextDueDate);

    schedule.push({
      round,
      dueDate: dueStr,
      completed: isCompleted,
      isCurrent,
    });

    round++;
    cursor.setDate(cursor.getDate() + cycleDays);
  }

  return {
    startDate: toDateStr(startDate),
    cycleDays,
    lastMonitoredAt: lastDone ? toDateStr(lastDone) : null,
    nextDueDate: toDateStr(nextDueDate),
    daysRemaining,
    urgency,
    schedule,
  };
}

/**
 * モニタリング期限のラベルを生成する。
 */
export function formatMonitoringDeadline(info: MonitoringScheduleInfo): string {
  switch (info.urgency) {
    case 'overdue':
      return `⚠ モニタリング期限超過 (${Math.abs(info.daysRemaining)}日超過 / 期限: ${info.nextDueDate})`;
    case 'due':
      return `🔴 本日がモニタリング期限です (${info.nextDueDate})`;
    case 'upcoming':
      return `🟡 モニタリング期限まで${info.daysRemaining}日 (${info.nextDueDate})`;
    case 'safe':
      return `🟢 次回モニタリング: ${info.nextDueDate} (${info.daysRemaining}日後)`;
  }
}
