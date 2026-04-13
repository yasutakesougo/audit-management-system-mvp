/**
 * monitoringSchedule.ts — L2 モニタリング期限計算ユーティリティ
 *
 * 支援開始日（supportStartDate）を起点に、
 * モニタリング周期（デフォルト 90日 = 3ヶ月）で次回期限を計算する。
 *
 * L1 ISP のモニタリング（6ヶ月周期）とは完全に別系統。
 *
 * @see docs/architecture/isp-three-layer-model.md
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** デフォルトのモニタリング周期（日数） */
export const DEFAULT_MONITORING_CYCLE_DAYS = 90;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** モニタリングスケジュール情報 */
export interface MonitoringScheduleInfo {
  /** 支援開始日 (ISO 8601 date) */
  supportStartDate: string;
  /** モニタリング周期（日数） */
  cycleDays: number;
  /** 次回モニタリング予定日 (ISO 8601 date) */
  nextMonitoringDate: string;
  /** 支援開始からの経過日数 */
  elapsedDays: number;
  /** 現在の周期番号（1始まり） */
  currentCycleNumber: number;
  /** 期限超過しているか */
  isOverdue: boolean;
  /** 期限超過日数（超過していない場合は 0） */
  overdueDays: number;
  /** 残り日数（超過の場合はマイナス） */
  remainingDays: number;
  /** 進捗率（0〜100%、超過時は 100 以上） */
  progressPercent: number;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * 日付文字列を UTC 0:00 の Date に変換する（ローカル TZ ずれ防止）
 */
function parseDate(isoDate: string): Date {
  if (!isoDate) return new Date(NaN);
  // '-' または '/' を区切り文字としてサポート
  const parts = isoDate.includes('-') ? isoDate.split('-') : isoDate.split('/');
  const [y, m, d] = parts.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date;
}

/**
 * 2つの日付の差を日数で返す
 */
function diffDays(from: Date, to: Date): number {
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Date に日数を加算して ISO date 文字列を返す
 */
function addDays(date: Date, days: number): string {
  if (isNaN(date.getTime())) return 'Invalid Date';
  const result = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  if (isNaN(result.getTime())) return 'Invalid Date';
  return result.toISOString().slice(0, 10);
}

/**
 * 支援開始日を起点に、モニタリングスケジュール情報を計算する。
 *
 * @param supportStartDate - 支援開始日 (ISO 8601 date, e.g. '2026-01-15')
 * @param cycleDays - モニタリング周期（日数、デフォルト 90）
 * @param today - 基準日（テスト用にオーバーライド可能）
 * @returns モニタリングスケジュール情報。日付が不正な場合は null。
 */
export function calculateMonitoringSchedule(
  supportStartDate: string,
  cycleDays: number = DEFAULT_MONITORING_CYCLE_DAYS,
  today: string = new Date().toISOString().slice(0, 10),
): MonitoringScheduleInfo | null {
  try {
    const start = parseDate(supportStartDate);
    const now = parseDate(today);

    if (isNaN(start.getTime()) || isNaN(now.getTime())) {
      return null;
    }

    const elapsedDays = diffDays(start, now);

    // 現在の周期番号: 開始日〜cycleDays は第1期、cycleDays+1〜2*cycleDays は第2期...
    const currentCycleNumber = Math.max(1, Math.ceil((elapsedDays + 1) / (cycleDays || DEFAULT_MONITORING_CYCLE_DAYS)));

    // 次回モニタリング予定日（現在の周期の終了日）
    const nextMonitoringDate = addDays(start, currentCycleNumber * cycleDays);

    if (nextMonitoringDate === 'Invalid Date') return null;

    const nextDate = parseDate(nextMonitoringDate);
    const remainingDays = diffDays(now, nextDate);
    const isOverdue = remainingDays < 0;
    const overdueDays = isOverdue ? Math.abs(remainingDays) : 0;

    // 進捗率: 現在の周期内での経過割合
    const cycleStartDay = (currentCycleNumber - 1) * cycleDays;
    const daysIntoCycle = elapsedDays - cycleStartDay;
    const progressPercent = cycleDays > 0 ? Math.round((daysIntoCycle / cycleDays) * 100) : 0;

    return {
      supportStartDate,
      cycleDays,
      nextMonitoringDate,
      elapsedDays,
      currentCycleNumber,
      isOverdue,
      overdueDays,
      remainingDays,
      progressPercent,
    };
  } catch (e) {
    console.error('calculateMonitoringSchedule failed:', e);
    return null;
  }
}

/**
 * 支援開始日が未設定の場合のフォールバック。
 * appliedFrom があればそれを使い、なければ null を返す。
 */
export function resolveSupportStartDate(
  supportStartDate: string | null | undefined,
  appliedFrom: string | null | undefined,
): string | null {
  if (supportStartDate) return supportStartDate;
  if (appliedFrom) return appliedFrom;
  return null;
}
