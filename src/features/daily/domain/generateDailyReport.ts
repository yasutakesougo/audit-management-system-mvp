// ---------------------------------------------------------------------------
// generateDailyReport — 日報テキスト生成の純粋関数
//
// ScheduleItem[] と ExecutionRecord[] をマージし、
// クリップボード用の整形済みテキストを出力する。
// ---------------------------------------------------------------------------
import type { ScheduleItem } from '../components/split-stream/ProcedurePanel';
import type { ExecutionRecord } from './executionRecordTypes';
import { getScheduleKey } from './getScheduleKey';

export type DailyReportOptions = {
  /** 日付 (YYYY-MM-DD) */
  date: string;
  /** 対象者名 */
  userName: string;
  /** 時間割 */
  schedule: ScheduleItem[];
  /** 実施記録 */
  records: ExecutionRecord[];
};

const STATUS_ICONS: Record<string, string> = {
  completed: '✅ 完了',
  triggered: '⚠️ 発動',
  skipped: '⏭️ スキップ',
  unrecorded: '— 未記録',
};

/**
 * 日報テキストを生成する
 *
 * @example
 * ```
 * 📋 日報: 田中太郎 様 — 2025/04/01
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 09:00 朝の受け入れ ✅ 完了
 * 09:15 持ち物整理 ✅ 完了
 * 10:00 作業活動 ⚠️ 発動 → イヤーマフで落ち着いた
 * 11:30 休憩 ⏭️ スキップ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 完了: 2 | 発動: 1 | スキップ: 1 | 未記録: 0 (全4件)
 * ```
 */
export function generateDailyReport({ date, userName, schedule, records }: DailyReportOptions): string {
  // 日付フォーマット: YYYY-MM-DD → YYYY/MM/DD
  const formattedDate = date.replace(/-/g, '/');

  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const lines: string[] = [];

  // ヘッダー
  lines.push(`📋 日報: ${userName} 様 — ${formattedDate}`);
  lines.push(separator);

  // recordsをscheduleItemIdでインデックス
  const recordMap = new Map<string, ExecutionRecord>();
  for (const r of records) {
    recordMap.set(r.scheduleItemId, r);
  }

  // 集計カウンター
  let completedCount = 0;
  let triggeredCount = 0;
  let skippedCount = 0;
  let unrecordedCount = 0;

  // 各時間帯
  for (const item of schedule) {
    const scheduleKey = getScheduleKey(item.time, item.activity);
    const record = recordMap.get(scheduleKey);
    const status = record?.status ?? 'unrecorded';

    // カウント
    switch (status) {
      case 'completed': completedCount++; break;
      case 'triggered': triggeredCount++; break;
      case 'skipped': skippedCount++; break;
      default: unrecordedCount++; break;
    }

    const statusLabel = STATUS_ICONS[status] ?? STATUS_ICONS.unrecorded;
    let line = `${item.time} ${item.activity} ${statusLabel}`;

    // triggered + メモがある場合は追記
    if (status === 'triggered' && record?.memo) {
      line += ` → ${record.memo}`;
    }

    lines.push(line);
  }

  // フッター
  lines.push(separator);
  lines.push(
    `完了: ${completedCount} | 発動: ${triggeredCount} | スキップ: ${skippedCount} | 未記録: ${unrecordedCount} (全${schedule.length}件)`,
  );

  return lines.join('\n');
}
